import { useActiveSessionStore } from '@/features/session/session-store';
import { clearStorage } from '@/lib/storage';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';

/**
 * Zustand stores are module singletons, so state survives between tests in the same file.
 * Clearing storage matters just as much: `jest.setup.ts` builds its AsyncStorage mock around
 * a single `Map` created in the factory closure, so every call in a file shares one store.
 * A suite that resets state but not storage passes alone and fails in company, because
 * `useActiveSessionStore`'s `persist` middleware rehydrates the previous test's tasks.
 *
 * These merge rather than replace. Passing `replace: true` looks tidier but breaks every
 * store here: the actions live in the same object as the data, so a replace deletes
 * `start`, `show`, `hydrate` and friends along with the state.
 */
export async function resetStores() {
  useSessionStore.setState({ status: 'loading', user: null });
  useToastStore.setState({ toast: null });
  // Every data field, not a convenient subset: `routineTitle`, `notes`, `startedAt` and
  // `userId` used to survive into the next test, which is the "passes alone, fails in
  // company" split this helper exists to prevent.
  useActiveSessionStore.setState({
    userId: undefined,
    routineId: undefined,
    routineTitle: undefined,
    title: undefined,
    notes: undefined,
    startedAt: undefined,
    tasks: [],
  });
  await clearStorage();
}
