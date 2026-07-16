/**
 * "Show Your Work" factors for palmistry — the deterministic transparency
 * layer, mirroring astrology's ChartFactor contract (factors.util.ts) so the
 * web's ShowYourWork component renders both identically.
 *
 * Every factor is a pure transform over (a) the structured reading and
 * (b) REAL measured hand geometry. No LLM output is generated here; the
 * measurement factors in particular cannot be hallucinated.
 */

import type { PalmMetrics } from './palm-metrics.util';

export interface PalmFactor {
  /** Stable machine id, e.g. "line.heart.strong", "measurement.handShape.Air". */
  code: string;
  label: string;
  detail?: string;
  contribution: 'positive' | 'negative' | 'neutral';
  source: 'line' | 'mount' | 'finger' | 'measurement' | 'marking';
}

interface AnalysisLike {
  lines?: Array<{ name?: string; strength?: string; subtitle?: string }>;
  mounts?: Array<{ name?: string; prominence?: string }>;
  fingerAnalysis?: Array<{ finger?: string; length?: string }>;
  specialMarkings?: Array<{ name?: string; location?: string }>;
  handShape?: { type?: string };
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export function buildPalmFactors(analysis: AnalysisLike, metrics: PalmMetrics | null): PalmFactor[] {
  const factors: PalmFactor[] = [];

  // ── Measured geometry first: these are real, deterministic observations ──
  if (metrics) {
    factors.push({
      code: `measurement.handShape.${metrics.handShape}`,
      label: `Measured hand shape: ${metrics.handShape}`,
      detail: `Palm width/length ratio ${metrics.palmAspect.toFixed(2)}, middle finger ${Math.round(
        metrics.fingerRatio * 100,
      )}% of palm length — computed from 21 detected hand landmarks, not estimated by AI.`,
      contribution: 'neutral',
      source: 'measurement',
    });
    for (const [finger, cls] of Object.entries(metrics.fingerClasses)) {
      if (cls === 'average') continue; // only notable deviations earn a factor
      factors.push({
        code: `measurement.finger.${finger}.${cls}`,
        label: `Measured ${finger} finger: ${cls}`,
        detail: `${Math.round(metrics.fingerRatios[finger as keyof typeof metrics.fingerRatios] * 100)}% of palm length.`,
        contribution: 'neutral',
        source: 'measurement',
      });
    }
  }

  // ── Reading-derived factors (what the palmist saw) ──
  for (const line of analysis.lines ?? []) {
    if (!line?.name || !line.strength) continue;
    const contribution =
      line.strength === 'strong' ? 'positive' : line.strength === 'weak' ? 'negative' : 'neutral';
    factors.push({
      code: `line.${slug(line.name)}.${line.strength}`,
      label: `${line.name}: ${line.strength}`,
      detail: line.subtitle || undefined,
      contribution,
      source: 'line',
    });
  }

  for (const mount of analysis.mounts ?? []) {
    if (!mount?.name || !mount.prominence) continue;
    factors.push({
      code: `mount.${slug(mount.name)}.${mount.prominence}`,
      label: `${mount.name}: ${mount.prominence}`,
      contribution:
        mount.prominence === 'elevated' ? 'positive' : mount.prominence === 'flat' ? 'negative' : 'neutral',
      source: 'mount',
    });
  }

  for (const finger of analysis.fingerAnalysis ?? []) {
    if (!finger?.finger || !finger.length) continue;
    factors.push({
      code: `finger.${slug(finger.finger)}.${finger.length}`,
      label: `${finger.finger} finger: ${finger.length}`,
      contribution: 'neutral',
      source: 'finger',
    });
  }

  for (const marking of analysis.specialMarkings ?? []) {
    if (!marking?.name) continue;
    factors.push({
      code: `marking.${slug(marking.name)}`,
      label: `Marking: ${marking.name}`,
      detail: marking.location || undefined,
      contribution: 'neutral',
      source: 'marking',
    });
  }

  return factors;
}
