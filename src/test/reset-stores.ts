import { useActiveSessionStore } from '@/features/session/session-store';
import { storage } from '@/lib/storage';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';

/**
 * Zustand stores are module singletons, so state survives between tests in the same file.
 * Clearing MMKV matters just as much: `jest.setup.ts` builds its mock around a single `Map`
 * created in the factory closure, so every `createMMKV()` call in a file shares one store.
 * A suite that resets state but not storage passes alone and fails in company, because
 * `useActiveSessionStore`'s `persist` middleware rehydrates the previous test's tasks.
 *
 * These merge rather than replace. Passing `replace: true` looks tidier but breaks every
 * store here: the actions live in the same object as the data, so a replace deletes
 * `start`, `show`, `hydrate` and friends along with the state.
 */
export function resetStores() {
  useSessionStore.setState({ status: 'loading', user: null });
  useToastStore.setState({ toast: null });
  useActiveSessionStore.setState({ routineId: undefined, title: undefined, tasks: [] });
  storage.clearAll();
}
