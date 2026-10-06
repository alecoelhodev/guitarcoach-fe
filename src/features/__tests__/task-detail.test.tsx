jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { AUTOMATIC: 'automatic' },
}));
jest.mock('@/api/tasks.queries', () => ({ useTask: jest.fn(), useDeleteTask: jest.fn() }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import { useDeleteTask, useTask } from '@/api/tasks.queries';
import { TaskDetail } from '@/features/library/task-detail';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';
import { linkHrefs, mockRouter } from '@/test/expo-router';
import { makeTask, makeUser } from '@/test/fixtures';
import { withGluestack } from '@/test/gluestack';
import { pressLinkTarget } from '@/test/press';
import { errorQuery, mutationStub, pendingQuery, successQuery } from '@/test/query-hooks';

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;
const mock = useTask as unknown as AnyHook;
const deleteHook = useDeleteTask as unknown as AnyHook;

let remove: ReturnType<typeof mutationStub>;

beforeEach(() => {
  jest.clearAllMocks();
  remove = mutationStub();
  deleteHook.mockReturnValue(remove);
});

describe('TaskDetail', () => {
  it('shows a skeleton while loading', async () => {
    mock.mockReturnValue(pendingQuery());
    await render(<TaskDetail taskId="t1" />);

    expect(screen.queryByText('Tasks are shared and read-only.')).toBeNull();
  });

  it('reports an unrecognised failure with its own fallback title', async () => {
    // A messageless, uncategorised status is what reaches the fallback. A 404 would render
    // describeError's own "Not found" copy instead, which is the point of that ladder.
    mock.mockReturnValue(errorQuery(new ApiError('', 418)));
    await render(<TaskDetail taskId="t1" />);

    expect(screen.getByText("Couldn't load this task")).toBeTruthy();
  });

  it("prefers describeError's specific copy over the fallback for a 404", async () => {
    mock.mockReturnValue(errorQuery(new ApiError('', 404)));
    await render(<TaskDetail taskId="t1" />);

    expect(screen.getByText('Not found')).toBeTruthy();
    expect(screen.queryByText("Couldn't load this task")).toBeNull();
  });

  it('renders a bare task without badges, description or reference', async () => {
    mock.mockReturnValue(successQuery(makeTask({ title: 'Alternate picking' })));
    await render(<TaskDetail taskId="t1" />);

    expect(screen.getByText('Alternate picking')).toBeTruthy();
    expect(screen.getByText('Tasks are shared and read-only.')).toBeTruthy();
    expect(screen.queryByText('Reference link')).toBeNull();
  });

  it('leads with the badges it has', async () => {
    mock.mockReturnValue(successQuery(makeTask({ category: 'repertoire', difficulty: 'medium' })));
    await render(<TaskDetail taskId="t1" />);

    expect(screen.getByText('repertoire')).toBeTruthy();
    expect(screen.getByText('medium')).toBeTruthy();
  });

  it('renders the description in a card when there is one', async () => {
    mock.mockReturnValue(successQuery(makeTask({ description: 'Down-up at 80bpm' })));
    await render(<TaskDetail taskId="t1" />);

    expect(screen.getByText('Down-up at 80bpm')).toBeTruthy();
  });

  // `{'' && …}` renders a bare string outside <Text>, which crashes on native.
  it('renders an empty description exactly as none', async () => {
    mock.mockReturnValue(successQuery(makeTask({ description: '' })));
    const empty = await render(<TaskDetail taskId="t1" />);
    const emptyTree = screen.toJSON();
    await empty.unmount();

    mock.mockReturnValue(successQuery(makeTask({ description: null })));
    await render(<TaskDetail taskId="t1" />);

    // Serialised: the trees carry fresh handler closures, so deep equality never holds.
    expect(JSON.stringify(emptyTree)).toBe(JSON.stringify(screen.toJSON()));
  });

  it('warns that a reference link leaves the app', async () => {
    mock.mockReturnValue(successQuery(makeTask({ referenceLink: 'https://example.com/lesson' })));
    await render(<TaskDetail taskId="t1" />);

    expect(screen.getByText('Reference link')).toBeTruthy();
    expect(screen.getByText('Opens outside the app')).toBeTruthy();
  });

  // A card that says "Opens outside the app" over plain text would read as a dead link.
  it.each(['javascript:alert(1)', 'example.com/lesson', 'mailto:coach@example.com'])(
    'hides the reference card for %s, which is not an http(s) URL',
    async (referenceLink) => {
      mock.mockReturnValue(successQuery(makeTask({ referenceLink })));
      await render(<TaskDetail taskId="t1" />);

      expect(screen.queryByText('Reference link')).toBeNull();
    },
  );

  it.each([
    ['an ordinary user', makeUser({ role: 'user' })],
    ['no cached user', null],
  ])('tells %s tasks are read-only, with no admin actions', async (_label, user) => {
    useSessionStore.setState({ status: user ? 'authenticated' : 'loading', user });
    mock.mockReturnValue(successQuery(makeTask()));
    await render(<TaskDetail taskId="t1" />);

    expect(screen.getByText('Tasks are shared and read-only.')).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });
});

describe('TaskDetail admin actions', () => {
  const asAdmin = async (task = makeTask({ id: 't1', title: 'Alternate picking' })) => {
    useSessionStore.setState({ status: 'authenticated', user: makeUser({ role: 'admin' }) });
    mock.mockReturnValue(successQuery(task));
    await render(withGluestack(<TaskDetail taskId="t1" />));
  };

  const confirmDelete = async () => {
    await fireEvent.press(screen.getByText('Delete'));
    await fireEvent.press(screen.getAllByText('Delete').at(-1) as never);
  };

  it('offers a pressable Edit link in place of the read-only note', async () => {
    await asAdmin();

    expect(screen.queryByText('Tasks are shared and read-only.')).toBeNull();
    expect(linkHrefs).toContainEqual({ pathname: '/library/[id]/edit', params: { id: 't1' } });
    await pressLinkTarget(screen.getByText('Edit'));
  });

  it('asks before deleting', async () => {
    await asAdmin();

    await fireEvent.press(screen.getByText('Delete'));

    expect(screen.getByText('Delete "Alternate picking"?')).toBeTruthy();
    expect(remove.mutateAsync).not.toHaveBeenCalled();
  });

  it('deletes and returns to the library once confirmed', async () => {
    await asAdmin();

    await confirmDelete();

    await waitFor(() => expect(remove.mutateAsync).toHaveBeenCalledWith('t1'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(main)/(tabs)/library');
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Task deleted' });
  });

  // No usage count on the DTO: the 409 is the only signal, so it gets its own words.
  it('explains a 409 as the task being in use, without offering a retry', async () => {
    remove.mutateAsync.mockRejectedValue(new ApiError('', 409));
    await asAdmin();

    await confirmDelete();

    expect(await screen.findByText("Can't delete this task")).toBeTruthy();
    expect(screen.getByText("It's used by a routine or a logged session.")).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('offers a retry for any other failure', async () => {
    remove.mutateAsync.mockRejectedValueOnce(new ApiError('', 503));
    await asAdmin();

    await confirmDelete();
    await fireEvent.press(await screen.findByText('Try again'));

    await waitFor(() => expect(remove.mutateAsync).toHaveBeenCalledTimes(2));
  });
});
