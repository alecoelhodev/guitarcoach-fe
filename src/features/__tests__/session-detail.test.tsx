jest.mock('@/api/recordings.queries', () => ({ useRecordings: jest.fn() }));
jest.mock('@/api/sessions.queries', () => ({ useSession: jest.fn() }));
jest.mock('@/api/tasks.queries', () => ({ useTask: jest.fn() }));
jest.mock('@/api/recordings', () => ({ getRecordingDownloadUrl: jest.fn() }));

import { render, screen } from '@testing-library/react-native';

import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { useRecordings } from '@/api/recordings.queries';
import { useSession } from '@/api/sessions.queries';
import { useTask } from '@/api/tasks.queries';
import { SessionDetail } from '@/features/history/session-detail';
import { makeRecording, makeSession, makeSessionTask, makeTask } from '@/test/fixtures';
import { emptyQuery, errorQuery, pendingQuery, successQuery } from '@/test/query-hooks';

/**
 * This screen hand-rolls its pending/error/data ladder instead of using `QueryState`, so the
 * ladder is driven directly. It also renders a private `SessionTaskRow` that calls `useTask`
 * itself to resolve a task title — hence the third mocked hook.
 */

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

const sessionHook = useSession as unknown as AnyHook;
const recordingsHook = useRecordings as unknown as AnyHook;
const taskHook = useTask as unknown as AnyHook;

const SESSION_ID = 's1';

beforeEach(() => {
  jest.clearAllMocks();
  recordingsHook.mockReturnValue(successQuery([]));
  taskHook.mockReturnValue(emptyQuery());
});

describe('loading and failure', () => {
  it('shows a skeleton while the session loads', async () => {
    sessionHook.mockReturnValue(pendingQuery());
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.queryByText('Practiced')).toBeNull();
  });

  it('reports a failure and offers a retry', async () => {
    const query = errorQuery<never>(new ApiError('boom', OFFLINE_STATUS));
    sessionHook.mockReturnValue(query);
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('No connection')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('falls back to its own title for an unrecognised failure', async () => {
    sessionHook.mockReturnValue(errorQuery(new ApiError('', 418)));
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText("Couldn't load this session")).toBeTruthy();
  });
});

describe('a finished session', () => {
  it('names an untitled session generically and still renders the header', async () => {
    sessionHook.mockReturnValue(successQuery(makeSession()));
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('Practice session')).toBeTruthy();
    expect(screen.getByText('Practiced')).toBeTruthy();
  });

  it('uses the session title and shows its notes', async () => {
    sessionHook.mockReturnValue(
      successQuery(makeSession({ title: 'Blues in A', notes: 'Felt sloppy' })),
    );
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('Blues in A')).toBeTruthy();
    expect(screen.getByText('Felt sloppy')).toBeTruthy();
  });

  it('copes with a session that recorded no tasks at all', async () => {
    sessionHook.mockReturnValue(successQuery(makeSession({ sessionTasks: undefined })));
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('Practiced')).toBeTruthy();
    expect(screen.queryByText('Not completed')).toBeNull();
  });

  it('shows the total only once some task carries minutes', async () => {
    const noMinutes = successQuery(
      makeSession({ sessionTasks: [makeSessionTask({ completed: true })] }),
    );
    sessionHook.mockReturnValue(noMinutes);
    const without = await render(<SessionDetail sessionId={SESSION_ID} />);
    expect(screen.queryByText('0 min')).toBeNull();
    await without.unmount();

    sessionHook.mockReturnValue(
      successQuery(
        makeSession({
          sessionTasks: [
            makeSessionTask({ taskId: 'a', durationMinutes: 20 }),
            makeSessionTask({ taskId: 'b', durationMinutes: 40 }),
          ],
        }),
      ),
    );
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('1h')).toBeTruthy();
  });
});

describe('task rows', () => {
  it('resolves each task title through useTask', async () => {
    taskHook.mockReturnValue(successQuery(makeTask({ title: 'Alternate picking' })));
    sessionHook.mockReturnValue(
      successQuery(
        makeSession({
          sessionTasks: [makeSessionTask({ taskId: 't1', durationMinutes: 15, completed: true })],
        }),
      ),
    );
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('Alternate picking')).toBeTruthy();
    // Twice: the session total in the "Practiced" header and the task row itself.
    expect(screen.getAllByText('15 min')).toHaveLength(2);
    expect(screen.queryByText('Not completed')).toBeNull();
  });

  it('falls back to the raw task id when the task lookup has not resolved', async () => {
    sessionHook.mockReturnValue(
      successQuery(makeSession({ sessionTasks: [makeSessionTask({ taskId: 'task-42' })] })),
    );
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('task-42')).toBeTruthy();
  });

  it('marks an incomplete task and shows an em dash when it logged no minutes', async () => {
    sessionHook.mockReturnValue(
      successQuery(
        makeSession({
          sessionTasks: [makeSessionTask({ taskId: 't1', completed: false })],
        }),
      ),
    );
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('Not completed')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders zero minutes as "0 min", not as an em dash', async () => {
    sessionHook.mockReturnValue(
      successQuery(
        makeSession({
          sessionTasks: [makeSessionTask({ taskId: 't1', durationMinutes: 0, completed: true })],
        }),
      ),
    );
    await render(<SessionDetail sessionId={SESSION_ID} />);

    // `!= null` rather than truthiness: a deliberately-logged zero is data, not an absence.
    expect(screen.getByText('0 min')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });
});

describe('recordings', () => {
  it('omits the section entirely when there are none', async () => {
    sessionHook.mockReturnValue(successQuery(makeSession()));
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.queryByText('Recordings')).toBeNull();
  });

  it('counts one recording in the singular', async () => {
    sessionHook.mockReturnValue(successQuery(makeSession()));
    recordingsHook.mockReturnValue(successQuery([makeRecording({ id: 'rec-1' })]));
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('Recordings')).toBeTruthy();
    expect(screen.getByText('1 file')).toBeTruthy();
  });

  it('counts several in the plural and renders a row each', async () => {
    sessionHook.mockReturnValue(successQuery(makeSession()));
    recordingsHook.mockReturnValue(
      successQuery([
        makeRecording({ id: 'rec-1', originalFileName: 'take-1.m4a' }),
        makeRecording({ id: 'rec-2', originalFileName: 'take-2.m4a' }),
      ]),
    );
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('2 files')).toBeTruthy();
    expect(screen.getByText('take-1.m4a')).toBeTruthy();
    expect(screen.getByText('take-2.m4a')).toBeTruthy();
  });

  it('renders the session even while the recordings query is still pending', async () => {
    sessionHook.mockReturnValue(successQuery(makeSession({ title: 'Blues in A' })));
    recordingsHook.mockReturnValue(pendingQuery());
    await render(<SessionDetail sessionId={SESSION_ID} />);

    expect(screen.getByText('Blues in A')).toBeTruthy();
    expect(screen.queryByText('Recordings')).toBeNull();
  });
});
