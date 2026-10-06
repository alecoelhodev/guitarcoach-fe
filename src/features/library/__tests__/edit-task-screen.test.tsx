jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/tasks.queries', () => ({ useTask: jest.fn(), useUpdateTask: jest.fn() }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import { useTask, useUpdateTask } from '@/api/tasks.queries';
import { EditTaskScreen } from '@/features/library/edit-task-screen';
import { useToastStore } from '@/stores/toast-store';
import { mockRouter } from '@/test/expo-router';
import { makeTask } from '@/test/fixtures';
import { errorQuery, mutationStub, pendingQuery, successQuery } from '@/test/query-hooks';

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;
const taskHook = useTask as unknown as AnyHook;
const updateHook = useUpdateTask as unknown as AnyHook;

const TASK = makeTask({
  id: 't1',
  title: 'Modes',
  category: 'theory',
  difficulty: 'medium',
  description: 'Over a drone.',
  referenceLink: 'https://example.com/modes',
});

let update: ReturnType<typeof mutationStub>;

beforeEach(() => {
  update = mutationStub(TASK);
  updateHook.mockReturnValue(update);
  taskHook.mockReturnValue(successQuery(TASK));
});

async function fill(testID: string, value: string) {
  const input = screen.getByTestId(testID);
  await fireEvent.changeText(input, value);
  await fireEvent(input, 'blur');
}

describe('EditTaskScreen', () => {
  it('shows the load failure instead of an empty form', async () => {
    taskHook.mockReturnValue(errorQuery(new ApiError('', 418)));
    await render(<EditTaskScreen taskId="t1" />);

    expect(screen.getByText("Couldn't load this task")).toBeTruthy();
    expect(screen.queryByTestId('task-title')).toBeNull();
  });

  it('renders no form while loading', async () => {
    taskHook.mockReturnValue(pendingQuery());
    await render(<EditTaskScreen taskId="t1" />);

    expect(screen.queryByTestId('task-title')).toBeNull();
  });

  it('pre-fills the saved task', async () => {
    await render(<EditTaskScreen taskId="t1" />);

    expect(screen.getByText('Edit task')).toBeTruthy();
    expect(screen.getByTestId('task-title').props.value).toBe('Modes');
    expect(screen.getByTestId('task-description').props.value).toBe('Over a drone.');
    expect(screen.getByTestId('task-link').props.value).toBe('https://example.com/modes');
  });

  it('sends only the fields that changed, then goes back', async () => {
    await render(<EditTaskScreen taskId="t1" />);

    await fill('task-title', '  Modes, revisited  ');
    await fireEvent.press(screen.getByText('Hard'));
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(update.mutateAsync).toHaveBeenCalledTimes(1));
    expect(update.mutateAsync).toHaveBeenCalledWith({
      title: 'Modes, revisited',
      difficulty: 'hard',
    });
    expect(mockRouter.back).toHaveBeenCalled();
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Task updated' });
  });

  it('can clear the description, which the contract accepts as an empty string', async () => {
    await render(<EditTaskScreen taskId="t1" />);

    await fill('task-description', '');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(update.mutateAsync).toHaveBeenCalledWith({ description: '' }));
  });

  it('goes back without a request when nothing changed', async () => {
    await render(<EditTaskScreen taskId="t1" />);

    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(update.mutateAsync).not.toHaveBeenCalled();
  });

  // UpdateTaskDto has no null: an empty link would 400, and dropping it would lose the edit.
  it('refuses to remove a saved link', async () => {
    await render(<EditTaskScreen taskId="t1" />);

    await fill('task-link', '');
    await fireEvent.press(screen.getByText('Save'));

    expect(await screen.findByText('A saved link can be changed, not removed.')).toBeTruthy();
    expect(update.mutateAsync).not.toHaveBeenCalled();
  });

  it('keeps a saved category selected when it is pressed again', async () => {
    await render(<EditTaskScreen taskId="t1" />);

    await fireEvent.press(screen.getByText('Theory'));
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(update.mutateAsync).not.toHaveBeenCalled();
  });

  it('still lets an unset category be picked and cleared', async () => {
    taskHook.mockReturnValue(successQuery({ ...TASK, category: null }));
    await render(<EditTaskScreen taskId="t1" />);

    await fireEvent.press(screen.getByText('Theory'));
    await fireEvent.press(screen.getByText('Theory'));
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(update.mutateAsync).not.toHaveBeenCalled();
  });

  it('shows a save failure and retries from the panel', async () => {
    update.mutateAsync.mockRejectedValueOnce(new ApiError('', 503));
    await render(<EditTaskScreen taskId="t1" />);

    await fill('task-title', 'Modes II');
    await fireEvent.press(screen.getByText('Save'));
    await fireEvent.press(await screen.findByText('Try again'));

    await waitFor(() => expect(update.mutateAsync).toHaveBeenCalledTimes(2));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});
