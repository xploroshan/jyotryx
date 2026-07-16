/**
 * Shared palm-analysis pipeline — the single implementation behind BOTH the
 * sync path (palmistry.service.ts, base64 data URL) and the async path
 * (queue/palmistry.processor.ts, R2 presigned URL):
 *
 *   1. Reading call (vision LLM, JSON mode) → parse → structural validation.
 *      One retry on invalid output; still invalid → PalmAnalysisFailedError.
 *      Under the honesty contract a failed analysis is surfaced and refunded,
 *      NEVER silently replaced with a canned reading.
 *   2. Deterministic metrics from the client-measured hand landmarks.
 *   3. Geometry call (vision LLM traces crease polylines, landmark-anchored).
 *      Best-effort: failure just means no wireframe.
 *   4. Grounding: measurable claims are cross-checked against the metrics and
 *      corrected where they disagree (measurements win).
 *   5. Factors ("Show Your Work") derived from reading + measurements.
 */

import { buildPalmistrySystemPrompt, buildPalmistryUserPrompt } from './palmistry.service';
import {
  buildGeometrySystemPrompt,
  buildGeometryUserPrompt,
  validatePolylines,
  type PalmPolyline,
} from './palm-geometry.util';
import {
  computePalmMetrics,
  type HandLandmarkInput,
  type PalmMetrics,
} from './palm-metrics.util';
import { validatePalmistryAnalysis } from './palm-validate.util';
import { buildPalmFactors, type PalmFactor } from './palm-factors.util';
import { groundAnalysis, type VerificationCheck } from './palm-verification.util';

export class PalmAnalysisFailedError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Palm analysis produced invalid output: ${problems.join(', ')}`);
    this.name = 'PalmAnalysisFailedError';
  }
}

export interface PalmGeometry {
  landmarks: HandLandmarkInput['landmarks'];
  handedness: HandLandmarkInput['handedness'];
  score: number;
  metrics: PalmMetrics | null;
  polylines: PalmPolyline[];
}

export interface PalmPipelineResult {
  /** Validated reading, with grounding corrections already applied. */
  analysisData: Record<string, unknown>;
  geometry: PalmGeometry | null;
  factors: PalmFactor[];
  grounding: { checks: VerificationCheck[]; groundednessScore: number; corrections: number };
}

interface PipelineLogger {
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

export interface LlmUsageLike {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface PalmPipelineOptions {
  /** Raw OpenAI SDK client (vision calls bypass the failover chain — other
   *  providers don't accept OpenAI-shaped image_url content). */
  client: {
    chat: { completions: { create: (req: unknown) => Promise<{
      choices: Array<{ message?: { content?: string | null } }>;
      usage?: LlmUsageLike | null;
    }> } };
  };
  readingModel: string;
  geometryModel: string;
  /** data: URL (sync path) or R2 presigned URL (queue path). */
  imageUrl: string;
  kbSection: string;
  locale?: string;
  gender?: string;
  landmarks: HandLandmarkInput | null;
  recordUsage: (model: string, usage: LlmUsageLike | null | undefined) => void;
  logger: PipelineLogger;
}

export async function runPalmVisionPipeline(opts: PalmPipelineOptions): Promise<PalmPipelineResult> {
  // ── 1. The reading, with one retry on invalid output ──
  let analysisData: Record<string, unknown> | null = null;
  let lastProblems: string[] = ['no_output'];
  for (let attempt = 1; attempt <= 2 && !analysisData; attempt++) {
    try {
      const completion = await opts.client.chat.completions.create({
        model: opts.readingModel,
        messages: [
          { role: 'system', content: buildPalmistrySystemPrompt(opts.kbSection, opts.locale, opts.gender) },
          {
            role: 'user',
            content: [
              { type: 'text', text: buildPalmistryUserPrompt(opts.gender) },
              { type: 'image_url', image_url: { url: opts.imageUrl, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 3500,
        response_format: { type: 'json_object' },
      });
      opts.recordUsage(opts.readingModel, completion?.usage);
      const content = completion.choices[0]?.message?.content;
      const parsed = content ? safeJsonParse(content) : null;
      if (!parsed) {
        lastProblems = ['invalid_json'];
        opts.logger.warn(`Palm reading attempt ${attempt}: invalid JSON from vision model`);
        continue;
      }
      const validation = validatePalmistryAnalysis(parsed);
      if (!validation.ok) {
        lastProblems = validation.problems;
        opts.logger.warn(
          `Palm reading attempt ${attempt}: failed validation (${validation.problems.join(', ')})`,
        );
        continue;
      }
      analysisData = stripReservedKeys(parsed as Record<string, unknown>);
    } catch (err) {
      lastProblems = ['vision_call_failed'];
      opts.logger.error(`Palm reading attempt ${attempt} failed`, err);
    }
  }
  if (!analysisData) throw new PalmAnalysisFailedError(lastProblems);

  // ── 2. Deterministic metrics from the measured landmarks ──
  const metrics = opts.landmarks ? computePalmMetrics(opts.landmarks.landmarks) : null;

  // ── 3. Crease geometry (best-effort — absence never blocks the reading) ──
  let polylines: PalmPolyline[] = [];
  try {
    const completion = await opts.client.chat.completions.create({
      model: opts.geometryModel,
      messages: [
        { role: 'system', content: buildGeometrySystemPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildGeometryUserPrompt(opts.landmarks) },
            { type: 'image_url', image_url: { url: opts.imageUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });
    opts.recordUsage(opts.geometryModel, completion?.usage);
    const content = completion.choices[0]?.message?.content;
    polylines = validatePolylines(content ? safeJsonParse(content) : null);
  } catch (err) {
    opts.logger.warn(`Palm geometry call failed — wireframe will be unavailable: ${(err as Error)?.message}`);
  }

  // ── 4. Grounding: measurements correct the model where they disagree ──
  const grounding = groundAnalysis(analysisData as never, metrics, polylines);
  if (grounding.corrections > 0) {
    opts.logger.warn(
      `Palm grounding corrected ${grounding.corrections} claim(s) against measured geometry`,
    );
  }

  // ── 5. Transparency factors ──
  const factors = buildPalmFactors(analysisData as never, metrics);

  const geometry: PalmGeometry | null = opts.landmarks || polylines.length
    ? {
        landmarks: opts.landmarks?.landmarks ?? [],
        handedness: opts.landmarks?.handedness ?? 'Right',
        score: opts.landmarks?.score ?? 0,
        metrics,
        polylines,
      }
    : null;

  return { analysisData, geometry, factors, grounding };
}

function safeJsonParse(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Envelope keys the model must never control. The reading is later spread
 * into the persisted/returned object (`{ id, userId, ...analysisData }`), so
 * a model output smuggling e.g. `"status": "processing"` would freeze a
 * charged reading in the client's polling loop, and `"id"`/`"verification"`
 * would spoof the envelope/authenticity block. The image itself is user
 * content, so prompt-injected outputs are in the threat model.
 */
const RESERVED_ANALYSIS_KEYS = [
  'id',
  'userId',
  'imageUrl',
  'status',
  'createdAt',
  'geometry',
  'factors',
  'verification',
  'verificationSeed',
  'message',
] as const;

function stripReservedKeys(data: Record<string, unknown>): Record<string, unknown> {
  for (const key of RESERVED_ANALYSIS_KEYS) {
    if (key in data) delete data[key];
  }
  return data;
}
