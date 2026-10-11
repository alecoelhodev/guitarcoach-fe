jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/tasks.queries', () => ({ useCreateTask: jest.fn() }));
jest.mock('@/api/routines.queries', () => ({
  useAddRoutineTask: jest.fn(),
  useInvalidateRoutines: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { useAddRoutineTask, useInvalidateRoutines } from '@/api/routines.queries';
import { useCreateTask } from '@/api/tasks.queries';
import { RoutineNewTaskScreen } from '@/features/routines/routine-new-task-screen';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';
import { mockRouter } from '@/test/expo-router';
import { makeTask, makeUser } from '@/test/fixtures';
import { mutationStub } from '@/test/query-hooks';

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

let create: ReturnType<typeof mutationStub>;
let add: ReturnType<typeof mutationStub>;
let invalidate: jest.Mock;

beforeEach(() => {
  create = mutationStub(makeTask({ id: 'new-task' }));
  add = mutationStub();
  invalidate = jest.fn();
  (useCreateTask as unknown as AnyHook).mockReturnValue(create);
  (useAddRoutineTask as unknown as AnyHook).mockReturnValue(add);
  (useInvalidateRoutines as unknown as AnyHook).mockReturnValue(invalidate);
  useSessionStore.setState({ status: 'authenticated', user: makeUser({ role: 'user' }) });
});

async function save(title = 'Riff A') {
  const input = screen.getByTestId('task-title');
  await fireEvent.changeText(input, title);
  await fireEvent(input, 'blur');
  await fireEvent.press(screen.getByText('Save'));
}

describe('RoutineNewTaskScreen', () => {
  it('creates the task, adds it to the routine and goes back to it', async () => {
    await render(<RoutineNewTaskScreen routineId="r1" />);

    await save('  Riff A  ');

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(create.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ title: 'Riff A' }));
    expect(useAddRoutineTask).toHaveBeenCalledWith('r1');
    expect(add.mutateAsync).toHaveBeenCalledWith({ taskId: 'new-task' });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Task added' });
  });

  it('tells a non-admin the task is private', async () => {
    await render(<RoutineNewTaskScreen routineId="r1" />);

    expect(screen.getByText('It is added to this routine. Only you can see it.')).toBeTruthy();
  });

  it('tells an admin the task also joins the Library', async () => {
    useSessionStore.setState({ user: makeUser({ role: 'admin' }) });
    await render(<RoutineNewTaskScreen routineId="r1" />);

    expect(screen.getByText('It is added to this routine and to the Library.')).toBeTruthy();
  });

  it('adds nothing when the create fails', async () => {
    create.mutateAsync.mockRejectedValueOnce(new ApiError('boom', 500));
    await render(<RoutineNewTaskScreen routineId="r1" />);

    await save();

    await screen.findByText('Something went wrong on our end');
    expect(add.mutateAsync).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('retries only the add when the create already landed', async () => {
    add.mutateAsync.mockRejectedValueOnce(new ApiError('offline', OFFLINE_STATUS));
    await render(<RoutineNewTaskScreen routineId="r1" />);

    await save();

    await screen.findByText('No connection');
    expect(screen.getByText(/^The task was saved\./)).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Try again'));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(create.mutateAsync).toHaveBeenCalledTimes(1);
    expect(add.mutateAsync).toHaveBeenCalledTimes(2);
  });
});
