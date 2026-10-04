jest.mock('@/api/persist', () => ({ purgePersistedCache: jest.fn() }));

import { purgePersistedCache } from '@/api/persist';
import { queryKeys } from '@/api/query-keys';
import { useActiveSessionStore } from '@/features/session/session-store';
import { clearLocalSession } from '@/stores/clear-local-session';
import { useSessionStore } from '@/stores/session-store';
import { makeUser } from '@/test/fixtures';
import { makeTestQueryClient } from '@/test/query-client';
import { resetStores } from '@/test/reset-stores';

const purgeMock = purgePersistedCache as jest.MockedFunction<typeof purgePersistedCache>;

/**
 * The teardown both exits from a session share. It exists as its own module because the 401
 * half of it lives in `src/app/_layout.tsx`, which no suite can mount and which coverage
 * excludes — so the sign-out path was the only one anyone ever checked, and the two drifted.
 */

beforeEach(async () => {
  jest.clearAllMocks();
  await resetStores();
});

describe('clearLocalSession', () => {
  it('forgets the cached user, both caches, and the practice in progress', async () => {
    const client = makeTestQueryClient();
    client.setQueryData(queryKeys.me, makeUser());
    await useSessionStore.getState().setUser(makeUser());
    useActiveSessionStore.getState().start({
      userId: 'user-1',
      routineId: 'r1',
      tasks: [{ taskId: 't1', title: 'A', durationMinutes: 5, completed: false }],
    });
    useActiveSessionStore.getState().setNotes('PRIVATE');

    await clearLocalSession(client);

    expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    expect(client.getQueryData(queryKeys.me)).toBeUndefined();
    expect(purgeMock).toHaveBeenCalledTimes(1);
    expect(useActiveSessionStore.getState()).toMatchObject({
      userId: undefined,
      routineId: undefined,
      notes: undefined,
      tasks: [],
    });
  });

  // QA-01: this is the one that was missing. An expired cookie sent the user to Sign In with
  // the practice session still on disk, and the next account to sign in was offered it.
  it('leaves nothing on disk for the next account to resume', async () => {
    useActiveSessionStore.getState().start({
      userId: 'user-1',
      tasks: [{ taskId: 't1', title: 'A', durationMinutes: 5, completed: false }],
    });

    await clearLocalSession(makeTestQueryClient());
    // A cold start reads the store back from AsyncStorage, so the write has to be empty too.
    await useActiveSessionStore.persist.rehydrate();

    expect(useActiveSessionStore.getState().tasks).toEqual([]);
  });

  // An expired cookie is not a change of user. The practice session carries the `userId` that
  // wrote it and every reader checks it, so keeping it costs no isolation — while wiping it
  // threw away minutes and notes that had never been anywhere but this device.
  it('keeps the practice in progress when only the cookie expired', async () => {
    const client = makeTestQueryClient();
    client.setQueryData(queryKeys.me, makeUser());
    await useSessionStore.getState().setUser(makeUser());
    useActiveSessionStore.getState().start({
      userId: 'user-1',
      tasks: [{ taskId: 't1', title: 'A', durationMinutes: 5, completed: false }],
    });
    useActiveSessionStore.getState().setNotes('UNSAVED');

    await clearLocalSession(client, { keepActiveSession: true });

    // Everything account-scoped still goes.
    expect(useSessionStore.getState()).toMatchObject({ status: 'unauthenticated', user: null });
    expect(client.getQueryData(queryKeys.me)).toBeUndefined();
    expect(purgeMock).toHaveBeenCalledTimes(1);
    // The unsaved practice does not.
    expect(useActiveSessionStore.getState()).toMatchObject({
      userId: 'user-1',
      notes: 'UNSAVED',
    });
    expect(useActiveSessionStore.getState().tasks).toHaveLength(1);
  });

  it('still clears the practice on a deliberate sign-out, which is the default', async () => {
    useActiveSessionStore.getState().start({
      userId: 'user-1',
      tasks: [{ taskId: 't1', title: 'A', durationMinutes: 5, completed: false }],
    });

    await clearLocalSession(makeTestQueryClient());

    expect(useActiveSessionStore.getState().tasks).toEqual([]);
  });
});
