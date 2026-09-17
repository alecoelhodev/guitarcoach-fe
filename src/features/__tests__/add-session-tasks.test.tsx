jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));
jest.mock('@/api/tasks.queries', () => ({ useTasks: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { useTasks } from '@/api/tasks.queries';
import { AddSessionTasks } from '@/features/session/add-session-tasks';
import { useActiveSessionStore } from '@/features/session/session-store';
import { makePage, makeTask } from '@/test/fixtures';
import { infinitePages } from '@/test/query-hooks';

/**
 * Canvas 07b's blank-session picker. The library screen's own suite covers pagination and the
 * query states; what is specific here is that picking seeds the *session* rather than writing
 * anything, and that a task already in the session cannot be picked twice.
 */

const useTasksMock = useTasks as jest.MockedFunction<typeof useTasks>;
type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

const TASKS = [
  makeTask({ id: 't1', title: 'Alternate picking' }),
  makeTask({ id: 't2', title: 'Sweep picking' }),
];

const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useTasksMock as unknown as AnyHook).mockReturnValue(infinitePages([makePage(TASKS)]));
  useActiveSessionStore.getState().start({ tasks: [] });
});

it('adds the picked tasks to the session and closes', async () => {
  await render(<AddSessionTasks onClose={onClose} />);

  await fireEvent.press(screen.getByLabelText('Alternate picking'));
  await fireEvent.press(screen.getByLabelText('Sweep picking'));
  await fireEvent.press(screen.getByText('Add 2 tasks'));

  expect(useActiveSessionStore.getState().tasks).toEqual([
    { taskId: 't1', title: 'Alternate picking', durationMinutes: 0, completed: false },
    { taskId: 't2', title: 'Sweep picking', durationMinutes: 0, completed: false },
  ]);
  expect(onClose).toHaveBeenCalledTimes(1);
});

// Canvas 07b labels the confirm with the count rather than a bare "Add".
it('counts the selection in the confirm label, and disables it while empty', async () => {
  await render(<AddSessionTasks onClose={onClose} />);

  expect(screen.getByText('Add 0 tasks')).toBeDisabled();

  await fireEvent.press(screen.getByLabelText('Alternate picking'));

  expect(screen.getByText('Add 1 task')).toBeTruthy();
});

it('deselects a task tapped twice rather than queuing it again', async () => {
  await render(<AddSessionTasks onClose={onClose} />);

  await fireEvent.press(screen.getByLabelText('Alternate picking'));
  await fireEvent.press(screen.getByLabelText('Alternate picking'));

  expect(screen.getByText('Add 0 tasks')).toBeTruthy();
});

/**
 * A task may appear at most once per session, and a duplicate in the Finish payload is a bare
 * 500 rather than a clean conflict — so the ones already picked are never offered again.
 */
it('hides tasks the session already holds', async () => {
  useActiveSessionStore.getState().addTask({
    taskId: 't1',
    title: 'Alternate picking',
    durationMinutes: 0,
    completed: false,
  });

  await render(<AddSessionTasks onClose={onClose} />);

  expect(screen.queryByLabelText('Alternate picking')).toBeNull();
  expect(screen.getByLabelText('Sweep picking')).toBeTruthy();
});

it('says so when the whole library is already in the session', async () => {
  for (const task of TASKS) {
    useActiveSessionStore
      .getState()
      .addTask({ taskId: task.id, title: task.title, durationMinutes: 0, completed: false });
  }

  await render(<AddSessionTasks onClose={onClose} />);

  expect(screen.getByText('Nothing left to add')).toBeTruthy();
});
