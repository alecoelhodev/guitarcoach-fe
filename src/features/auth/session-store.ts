import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { getSession } from '@/api/auth';
import type { User } from '@/types/user';

const SESSION_CACHE_KEY = 'guitar-coach.cached-user';

type SessionState = {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: User | null;
  hydrate: () => Promise<void>;
  setUser: (user: User) => void;
  clear: () => void;
};

/**
 * The auth session itself lives in an httpOnly cookie (better-auth) — this store
 * only caches the last-known user so the app can render a session gate instantly
 * on boot, then reconciles with `getSession()`.
 */
export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  user: null,

  hydrate: async () => {
    const cached = await SecureStore.getItemAsync(SESSION_CACHE_KEY);
    if (cached) set({ user: JSON.parse(cached) as User });

    try {
      const session = await getSession();
      if (session?.user) {
        await SecureStore.setItemAsync(SESSION_CACHE_KEY, JSON.stringify(session.user));
        set({ status: 'authenticated', user: session.user });
      } else {
        await SecureStore.deleteItemAsync(SESSION_CACHE_KEY);
        set({ status: 'unauthenticated', user: null });
      }
    } catch {
      // Network unreachable: fall back to the cached user rather than bouncing to sign-in.
      set((state) => ({ status: state.user ? 'authenticated' : 'unauthenticated' }));
    }
  },

  setUser: (user) => {
    SecureStore.setItemAsync(SESSION_CACHE_KEY, JSON.stringify(user));
    set({ status: 'authenticated', user });
  },

  clear: () => {
    SecureStore.deleteItemAsync(SESSION_CACHE_KEY);
    set({ status: 'unauthenticated', user: null });
  },
}));
