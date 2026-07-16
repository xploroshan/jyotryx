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
  majorLineCoverage,
  MAJOR_LINE_NAMES,
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

/** Confident negative verdicts from the vision model's image check. */
export type PalmImageRejection = 'back_of_hand' | 'not_a_hand';

export class PalmAnalysisFailedError extends Error {
  constructor(
    public readonly problems: string[],
    /** Set when the image itself was rejected (wrong side / no hand) —
     *  callers surface a SPECIFIC actionable error instead of the generic
     *  "couldn't analyze" (the back-of-hand incident: the camera gates can't
     *  geometrically tell an opposite-hand dorsal view from a palm, so this
     *  appearance-aware verdict is the authoritative rejection). */
    public readonly reason?: PalmImageRejection,
  ) {
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
      // Image-content gate FIRST: the model classifies what it actually sees
      // before any reading is accepted. A confident negative (back of hand /
      // no hand) is an ANSWER, not a transient failure — no retry, and the
      // caller turns it into a specific 422 instead of a generic 503.
      const subject = readImageCheckSubject(parsed);
      if (subject === 'back_of_hand' || subject === 'not_a_hand') {
        throw new PalmAnalysisFailedError([`image_${subject}`], subject);
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
      // A reasoned rejection must propagate — re-running the model on the
      // same back-of-hand image would just burn tokens for the same verdict.
      if (err instanceof PalmAnalysisFailedError) throw err;
      lastProblems = ['vision_call_failed'];
      opts.logger.error(`Palm reading attempt ${attempt} failed`, err);
    }
  }
  if (!analysisData) throw new PalmAnalysisFailedError(lastProblems);

  // ── 2. Deterministic metrics from the measured landmarks ──
  const metrics = opts.landmarks ? computePalmMetrics(opts.landmarks.landmarks) : null;

  // ── 3. Crease geometry (best-effort — absence never blocks the reading).
  // A sparse trace makes a sparse wireframe, and users judge the feature on
  // it: when the first attempt misses major lines, retry ONCE with a
  // corrective nudge naming what's missing, then merge (each line keeps its
  // best trace; extra minors from either attempt are kept). ──
  let polylines: PalmPolyline[] = [];
  const runGeometryCall = async (extraNudge?: string): Promise<PalmPolyline[]> => {
    const completion = await opts.client.chat.completions.create({
      model: opts.geometryModel,
      messages: [
        { role: 'system', content: buildGeometrySystemPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildGeometryUserPrompt(opts.landmarks) + (extraNudge ?? '') },
            { type: 'image_url', image_url: { url: opts.imageUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });
    opts.recordUsage(opts.geometryModel, completion?.usage);
    const content = completion.choices[0]?.message?.content;
    return validatePolylines(content ? safeJsonParse(content) : null);
  };
  try {
    polylines = await runGeometryCall();
    if (majorLineCoverage(polylines) < 0.8) {
      const found = new Set(polylines.filter((p) => p.kind === 'major').map((p) => p.name.toLowerCase()));
      const missing = MAJOR_LINE_NAMES.filter((n) => !found.has(n.toLowerCase()));
      opts.logger.warn(
        `Palm geometry attempt 1 traced only ${found.size}/5 major lines — retrying for: ${missing.join(', ')}`,
      );
      try {
        const second = await runGeometryCall(
          `\n\nYour previous trace missed these major lines: ${missing.join(', ')}. ` +
            'The Heart, Head and Life lines are prominently visible on virtually every open palm — look again carefully and trace ALL visible major lines plus the minor lines and branches.',
        );
        polylines = mergePolylines(polylines, second);
      } catch (retryErr) {
        opts.logger.warn(`Palm geometry retry failed — keeping first trace: ${(retryErr as Error)?.message}`);
      }
    }
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

/**
 * Merge two geometry attempts: every line keeps its best trace (more points
 * wins, then higher confidence), and lines unique to either attempt are kept.
 */
function mergePolylines(a: PalmPolyline[], b: PalmPolyline[]): PalmPolyline[] {
  const byKey = new Map<string, PalmPolyline>();
  for (const line of [...a, ...b]) {
    const key = `${line.name.toLowerCase()}|${line.kind}`;
    const existing = byKey.get(key);
    if (
      !existing ||
      line.points.length > existing.points.length ||
      (line.points.length === existing.points.length && line.confidence > existing.confidence)
    ) {
      byKey.set(key, line);
    }
  }
  return [...byKey.values()];
}

/** Read the model's image-content verdict (tolerant of shape drift). */
function readImageCheckSubject(parsed: unknown): string | null {
  const check = (parsed as { imageCheck?: { subject?: unknown } } | null)?.imageCheck;
  const subject = typeof check?.subject === 'string' ? check.subject.toLowerCase().trim() : null;
  return subject;
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
  // Gate artifact, consumed above — not reading content, and the polling
  // envelope uses failCode, which the model must not be able to spoof.
  'imageCheck',
  'failCode',
] as const;

function stripReservedKeys(data: Record<string, unknown>): Record<string, unknown> {
  for (const key of RESERVED_ANALYSIS_KEYS) {
    if (key in data) delete data[key];
  }
  return data;
}
