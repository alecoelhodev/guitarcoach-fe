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
 *
 * `keepActiveSession` is the one thing the two callers differ on, and it is deliberate.
 * Add anything else account-scoped here rather than to a caller.
 */
export async function clearLocalSession(
  client: QueryClient,
  { keepActiveSession = false }: { keepActiveSession?: boolean } = {},
) {
  // An expired cookie is not a change of user, and the practice session on disk carries the
  // `userId` that wrote it — every reader checks it, so leaving it costs no isolation. Wiping
  // it did cost something: a 401 landing on Finish Session threw away the minutes and notes
  // that had never been anywhere but this device, without saying so. Signing out is a
  // deliberate act and still clears everything.
  if (!keepActiveSession) useActiveSessionStore.getState().reset();
  await useSessionStore.getState().clear();
  client.clear();
  await purgePersistedCache();
}

let expiring: Promise<void> | undefined;

/**
 * The 401 handler. One expired cookie fails every request in flight at once, so this runs
 * the teardown once: later 401s join the one in progress, and once it has settled the
 * status stays 'unauthenticated' until the next sign-in re-arms it.
 */
export function expireSession(client: QueryClient) {
  if (useSessionStore.getState().status === 'unauthenticated') return Promise.resolve();
  expiring ??= clearLocalSession(client, { keepActiveSession: true }).finally(() => {
    expiring = undefined;
  });
  return expiring;
}
