jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/tasks.queries', () => ({ useCreateTask: jest.fn() }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import { useCreateTask } from '@/api/tasks.queries';
import { NewTaskScreen } from '@/features/library/new-task-screen';
import { useToastStore } from '@/stores/toast-store';
import { mockRouter } from '@/test/expo-router';
import { makeTask } from '@/test/fixtures';
import { mutationStub } from '@/test/query-hooks';

const createHook = useCreateTask as unknown as jest.MockedFunction<(...args: never[]) => unknown>;

let create: ReturnType<typeof mutationStub>;

beforeEach(() => {
  create = mutationStub(makeTask({ id: 'new-task' }));
  createHook.mockReturnValue(create);
});

async function fill(testID: string, value: string) {
  const input = screen.getByTestId(testID);
  await fireEvent.changeText(input, value);
  await fireEvent(input, 'blur');
}

describe('NewTaskScreen', () => {
  it('creates the task with trimmed fields and opens it', async () => {
    await render(<NewTaskScreen />);

    await fill('task-title', '  Modes of the major scale  ');
    await fireEvent.press(screen.getByText('Theory'));
    await fireEvent.press(screen.getByText('Medium'));
    await fill('task-description', '  Play each mode over a drone.  ');
    await fill('task-link', 'https://example.com/modes');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(create.mutateAsync).toHaveBeenCalledTimes(1));
    expect(create.mutateAsync).toHaveBeenCalledWith({
      title: 'Modes of the major scale',
      category: 'theory',
      difficulty: 'medium',
      description: 'Play each mode over a drone.',
      referenceLink: 'https://example.com/modes',
    });
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/library/[id]',
      params: { id: 'new-task' },
    });
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Task created' });
  });

  it('sends only the title when nothing else is set', async () => {
    await render(<NewTaskScreen />);

    await fill('task-title', 'Chromatic warm-up');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(create.mutateAsync).toHaveBeenCalledTimes(1));
    expect(create.mutateAsync).toHaveBeenCalledWith({
      title: 'Chromatic warm-up',
      category: undefined,
      difficulty: undefined,
      description: undefined,
      referenceLink: undefined,
    });
  });

  it('deselects a chip on a second press', async () => {
    await render(<NewTaskScreen />);

    await fill('task-title', 'Chromatic warm-up');
    await fireEvent.press(screen.getByText('Technique'));
    await fireEvent.press(screen.getByText('Technique'));
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(create.mutateAsync).toHaveBeenCalledTimes(1));
    expect(create.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ category: undefined }),
    );
  });

  it('refuses a one-character title', async () => {
    await render(<NewTaskScreen />);

    await fill('task-title', 'A');
    await fireEvent.press(screen.getByText('Save'));

    expect(await screen.findByText('Give the task a title before saving.')).toBeTruthy();
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  // `javascript:` and app deep links must never be stored as a pressable reference.
  it.each(['javascript:alert(1)', 'guitarcoach://home', 'not a url'])(
    'refuses the link %s',
    async (link) => {
      await render(<NewTaskScreen />);

      await fill('task-title', 'Chromatic warm-up');
      await fill('task-link', link);
      await fireEvent.press(screen.getByText('Save'));

      expect(await screen.findByText('Use a full http:// or https:// link.')).toBeTruthy();
      expect(create.mutateAsync).not.toHaveBeenCalled();
    },
  );

  it('shows the access error when the backend refuses a non-admin', async () => {
    create.mutateAsync.mockRejectedValue(new ApiError('Forbidden', 403));
    await render(<NewTaskScreen />);

    await fill('task-title', 'Chromatic warm-up');
    await fireEvent.press(screen.getByText('Save'));

    expect(await screen.findByText("You don't have access")).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('goes back without saving', async () => {
    await render(<NewTaskScreen />);

    await fireEvent.press(screen.getByLabelText('Go back'));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });
});
