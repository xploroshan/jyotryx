/**
 * Unified feature lookup across all traditions. Keeps the per-tradition
 * registries independent (Vedic in registry.tsx, the rest in registry.p3.tsx)
 * while giving the runner one entry point.
 */
import type { TraditionId } from '@myastro360/shared';
import type { FeatureSpec } from './spec';
import { VEDIC_FEATURES } from './registry';
import {
  WESTERN_FEATURES,
  CHINESE_FEATURES,
  HELLENISTIC_FEATURES,
  HORARY_FEATURES,
  MEDICAL_FEATURES,
} from './registry.p3';

const BY_TRADITION: Record<TraditionId, Record<string, FeatureSpec>> = {
  VEDIC: VEDIC_FEATURES,
  WESTERN: WESTERN_FEATURES,
  CHINESE: CHINESE_FEATURES,
  HELLENISTIC: HELLENISTIC_FEATURES,
  HORARY: HORARY_FEATURES,
  MEDICAL: MEDICAL_FEATURES,
};

export function getFeature(tradition: TraditionId, slug: string): FeatureSpec | null {
  return BY_TRADITION[tradition]?.[slug] ?? null;
}

export type { FeatureSpec } from './spec';
