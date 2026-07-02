/**
 * Feature-framework types. Pure (no React) so request builders stay unit-
 * testable without the React Native runtime.
 */
import type { FeatureGate, TraditionId, User } from '@myastro360/shared';

export type FieldType = 'text' | 'date' | 'time' | 'place' | 'number' | 'select';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  optional?: boolean; // sent only when non-empty (question/concern/lat/lng)
  placeholder?: string;
  options?: FieldOption[]; // for select
  /** Prefill from the signed-in user's profile. */
  prefillFromProfile?: 'dateOfBirth' | 'timeOfBirth' | 'placeOfBirth' | 'name';
  default?: string;
  help?: string;
  /** Render this field only when the predicate holds (e.g. numerology mode). */
  showIf?: (values: Values) => boolean;
}

export interface FeatureRequest {
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
}

export interface RequestCtx {
  user: Pick<
    User,
    'dateOfBirth' | 'timeOfBirth' | 'placeOfBirth' | 'name' | 'primaryTradition'
  > | null;
  locale: string;
}

export type Values = Record<string, string>;

/** Pure request builder: collected form values + context → an API request. */
export type BuildRequest = (values: Values, ctx: RequestCtx) => FeatureRequest;
