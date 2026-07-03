/**
 * MMKV-backed storage adapter for Zustand persist and the TanStack Query
 * cache. MMKV is synchronous + fast (JSI), which keeps warm loads instant and
 * powers offline reads (see app plan §6, §9). Sensitive tokens do NOT live
 * here — those are in expo-secure-store.
 */
import { MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

export const storage = new MMKV({ id: 'myastro360' });

/** Zustand `StateStorage` implementation on top of MMKV. */
export const zustandMMKVStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.delete(name),
};
