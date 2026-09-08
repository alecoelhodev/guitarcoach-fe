jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { AUTOMATIC: 'automatic' },
}));
jest.mock('@/api/tasks.queries', () => ({ useTask: jest.fn() }));

import { render, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import { useTask } from '@/api/tasks.queries';
import { TaskDetail } from '@/features/library/task-detail';
import { makeTask } from '@/test/fixtures';
import { errorQuery, pendingQuery, successQuery } from '@/test/query-hooks';

const mock = useTask as unknown as jest.MockedFunction<(...args: never[]) => unknown>;

beforeEach(() => jest.clearAllMocks());

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

  it('warns that a reference link leaves the app', async () => {
    mock.mockReturnValue(successQuery(makeTask({ referenceLink: 'https://example.com/lesson' })));
    await render(<TaskDetail taskId="t1" />);

    expect(screen.getByText('Reference link')).toBeTruthy();
    expect(screen.getByText('Opens outside the app')).toBeTruthy();
  });

  it('always says tasks are read-only, since write routes are admin-gated', async () => {
    mock.mockReturnValue(successQuery(makeTask()));
    await render(<TaskDetail taskId="t1" />);

    expect(screen.getByText('Tasks are shared and read-only.')).toBeTruthy();
  });
});
