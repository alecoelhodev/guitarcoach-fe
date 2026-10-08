jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/coach.queries', () => ({ useGenerateTaskDrafts: jest.fn() }));
jest.mock('@/api/tasks.queries', () => ({ useBulkCreateTasks: jest.fn() }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import { useGenerateTaskDrafts } from '@/api/coach.queries';
import { useBulkCreateTasks } from '@/api/tasks.queries';
import { GenerateTasksScreen } from '@/features/library/generate-tasks-screen';
import { useToastStore } from '@/stores/toast-store';
import { mockRouter } from '@/test/expo-router';
import { mutationStub } from '@/test/query-hooks';
import type { TaskDraft } from '@/types/task';

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;
const generateHook = useGenerateTaskDrafts as unknown as AnyHook;
const bulkHook = useBulkCreateTasks as unknown as AnyHook;

const DRAFTS: TaskDraft[] = [
  {
    title: 'Pull Me Under: intro riff',
    description: 'Bars 1-8 at 70 bpm.',
    category: 'repertoire',
    difficulty: 'hard',
  },
  {
    title: 'Trivium: In Waves verse',
    description: 'Palm-muted gallops.',
    category: 'repertoire',
    difficulty: 'medium',
  },
];

let generate: ReturnType<typeof mutationStub>;
let bulk: ReturnType<typeof mutationStub>;

beforeEach(() => {
  generate = mutationStub({ drafts: DRAFTS });
  bulk = mutationStub([]);
  generateHook.mockReturnValue(generate);
  bulkHook.mockReturnValue(bulk);
});

async function draftTasks(prompt = '  Famous 7-string riffs  ') {
  await fireEvent.changeText(screen.getByTestId('generate-prompt'), prompt);
  await act(async () => {
    await fireEvent.press(screen.getByText('Generate'));
  });
}

describe('GenerateTasksScreen', () => {
  it('drafts the chosen number of tasks from a trimmed prompt', async () => {
    await render(<GenerateTasksScreen />);

    await fireEvent.press(screen.getByText('8'));
    await draftTasks();

    expect(generate.mutateAsync).toHaveBeenCalledWith({
      prompt: 'Famous 7-string riffs',
      count: 8,
    });
    expect(screen.getByText('Pull Me Under: intro riff')).toBeTruthy();
    expect(screen.getByText('Repertoire · Hard')).toBeTruthy();
    expect(screen.getByText('Create 2 tasks')).toBeTruthy();
  });

  it('sends nothing for an empty prompt', async () => {
    await render(<GenerateTasksScreen />);

    await draftTasks('   ');

    expect(generate.mutateAsync).not.toHaveBeenCalled();
  });

  it('creates only the ticked drafts, then goes back with a toast', async () => {
    await render(<GenerateTasksScreen />);
    await draftTasks();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Trivium: In Waves verse' }));
    expect(screen.getByText('Create 1 task')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByText('Create 1 task'));
    });

    expect(bulk.mutateAsync).toHaveBeenCalledWith([
      {
        title: 'Pull Me Under: intro riff',
        description: 'Bars 1-8 at 70 bpm.',
        category: 'repertoire',
        difficulty: 'hard',
      },
    ]);
    expect(useToastStore.getState().toast).toMatchObject({
      message: '1 task created',
      variant: 'success',
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('cannot create with every draft unticked', async () => {
    await render(<GenerateTasksScreen />);
    await draftTasks();

    for (const draft of DRAFTS) {
      await fireEvent.press(screen.getByRole('checkbox', { name: draft.title }));
    }
    await act(async () => {
      await fireEvent.press(screen.getByText('Create 0 tasks'));
    });

    expect(bulk.mutateAsync).not.toHaveBeenCalled();
  });

  it('shows the generating card while the AI works', async () => {
    generateHook.mockReturnValue({ ...generate, isPending: true });
    await render(<GenerateTasksScreen />);

    expect(screen.getByText('Drafting your tasks…')).toBeTruthy();
    expect(screen.getByText('Drafting…')).toBeTruthy();
  });

  it('names the hourly AI limit rather than the generic one', async () => {
    generate.mutateAsync.mockRejectedValue(new ApiError('limited', 429));
    await render(<GenerateTasksScreen />);

    await draftTasks();

    expect(screen.getByText('Too many AI requests')).toBeTruthy();
    expect(screen.getByText('Try again later.')).toBeTruthy();
  });

  it('keeps the drafts and says so when creating fails', async () => {
    bulk.mutateAsync.mockRejectedValue(new ApiError('down', 503));
    await render(<GenerateTasksScreen />);
    await draftTasks();

    await act(async () => {
      await fireEvent.press(screen.getByText('Create 2 tasks'));
    });

    expect(screen.getByText('Something went wrong on our end')).toBeTruthy();
    expect(screen.getByText('Pull Me Under: intro riff')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
