import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/** AsyncStorage is part of the Expo Go runtime and falls back to localStorage on web, so no
 * platform file is needed here. It is asynchronous, unlike the MMKV it replaced — so every
 * consumer awaits, and `persist` rehydration is no longer complete on the first render.
 * Anything reading persisted state during render has to gate on hydration; see
 * `src/features/session/active-session-screen.tsx`. */
/* `satisfies` rather than `:` — an annotation would widen the return types to
 * `StateStorage`'s `unknown`, and `createAsyncStoragePersister` needs the precise
 * `Promise<void>` its own `AsyncStorage<string>` declares. */
export const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
} satisfies StateStorage;

/** Wipes every key, so this is a test hatch rather than app code — see `src/test/reset-stores.ts`. */
export const clearStorage = () => AsyncStorage.clear();
