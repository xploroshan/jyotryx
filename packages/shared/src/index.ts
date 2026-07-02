/**
 * @myastro360/shared — framework-agnostic core shared by web + mobile.
 *
 * Consumed as TypeScript source (Metro on mobile transpiles it directly; Next
 * would use `transpilePackages`). No React / Zustand / Next / Expo imports live
 * here, so it stays portable across both runtimes.
 */

export * from './api-client';
export * from './endpoints';
export * from './traditions';
export * from './gating';
export * from './types';
