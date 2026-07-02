import type { ComponentType } from 'react';
import type { FeatureGate, User } from '@myastro360/shared';
import type { BuildRequest, FieldSpec } from './types';

/**
 * A feature spec drives the FeatureRunner: input fields + gate + a pure request
 * builder + a result renderer (+ optional interpretation payload, an onSuccess
 * side-effect, or a fully custom screen). Shared by all traditions.
 */
export interface FeatureSpec {
  slug: string;
  title: string;
  subtitle?: string;
  gate: FeatureGate;
  featureKey: string;
  autoRun?: boolean;
  requiresBirthProfile?: boolean;
  submitLabel?: string;
  fields: FieldSpec[];
  build: BuildRequest;
  Result: ComponentType<{ data: unknown }>;
  domain?: string;
  interpretationPayload?: (data: never) => Record<string, unknown>;
  /** Side-effect after a successful request (e.g. horary saves to local history). */
  onSuccess?: (data: unknown, user: User | null) => void;
  /** Fully custom screen (bypasses the generic form/request flow). */
  custom?: ComponentType;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asResult = (C: ComponentType<{ data: any }>) => C as ComponentType<{ data: unknown }>;

// Shared birth-detail fields (reused across Vedic + Western/Chinese/Hellenistic).
export const dobField: FieldSpec = { key: 'dob', label: 'Date of birth', type: 'date', required: true, prefillFromProfile: 'dateOfBirth' };
export const tobField: FieldSpec = { key: 'tob', label: 'Time of birth', type: 'time', required: true, prefillFromProfile: 'timeOfBirth' };
export const pobField: FieldSpec = { key: 'pob', label: 'Place of birth', type: 'place', required: true, prefillFromProfile: 'placeOfBirth' };
export const latField: FieldSpec = { key: 'lat', label: 'Latitude', type: 'number', optional: true };
export const lngField: FieldSpec = { key: 'lng', label: 'Longitude', type: 'number', optional: true };
