import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/** createMMKV resolves to a real MMKV instance on native and a localStorage-backed
 * shim on web (react-native-mmkv's own `.web` implementation) — no platform file needed here. */
export const storage = createMMKV({ id: 'guitar-coach' });

export const mmkvStorage: StateStorage = {
  setItem: (key, value) => storage.set(key, value),
  getItem: (key) => storage.getString(key) ?? null,
  removeItem: (key) => storage.remove(key),
};
