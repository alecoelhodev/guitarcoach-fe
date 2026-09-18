import type { QueryClient } from '@tanstack/react-query';

import { purgePersistedCache } from '@/api/persist';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useSessionStore } from '@/stores/session-store';

/**
 * Everything this device remembers about the signed-in user, forgotten in one place.
 *
 * Both exits from a session run it: the deliberate sign-out and the 401 handler that fires
 * when a cookie expires underneath the app. They used to clear three things each, separately,
 * and both missed the fourth — the in-progress practice session, which persists under one
 * device-wide key. The next account to sign in was then offered "Resume practice session?"
 * and could read the previous user's routine, minutes and unsaved notes.
 *
 * The client is passed rather than imported so the caller decides which one it means — the
 * app has a single instance, but `useSignOut` reads it from context.
 * `clear()` only empties memory, so the persisted snapshot has to go with it.
 */
export async function clearLocalSession(client: QueryClient) {
  useActiveSessionStore.getState().reset();
  await useSessionStore.getState().clear();
  client.clear();
  await purgePersistedCache();
}
