jest.mock('@/api/client', () => ({ request: jest.fn(), upload: jest.fn() }));

import { getSession, requestPasswordReset, signIn, signOut, signUp } from '@/api/auth';
import { request, upload } from '@/api/client';
import { instantCreateRoutine, requestPracticePlan, resolvePracticePlan } from '@/api/coach';
import {
  deleteRecording,
  getRecordingDownloadUrl,
  listRecordings,
  uploadRecording,
} from '@/api/recordings';
import {
  addRoutineTask,
  createRoutine,
  deleteRoutine,
  getRoutine,
  listRoutines,
  listRoutineTasks,
  removeRoutineTask,
  reorderRoutineTasks,
  updateRoutine,
  updateRoutineTask,
} from '@/api/routines';
import {
  createSession,
  deleteSessionsByTitle,
  getSession as getPracticeSession,
  listSessions,
} from '@/api/sessions';
import { getTask, listTasks } from '@/api/tasks';

/**
 * Every transport function forwards to `request()`, so what is asserted is the URL, the verb
 * and the payload shape — the three things a caller cannot see and the compiler cannot check.
 *
 * This is not a tautology: `a3caba8` ("update API paths to include versioning") changed these
 * paths wholesale, and `/auth/*` routes must carry `unprefixed: true` because better-auth
 * mounts outside the API version prefix. A path typo or a lost `unprefixed` compiles, ships,
 * and 404s at runtime; here it fails.
 */

const requestMock = request as jest.MockedFunction<typeof request>;
const uploadMock = upload as jest.MockedFunction<typeof upload>;

beforeEach(() => jest.clearAllMocks());

describe('auth — every route is unprefixed, because better-auth mounts outside the prefix', () => {
  it('signUp', () => {
    signUp({ email: 'jordan@example.com', password: 'pw', name: 'Jordan' });

    expect(requestMock).toHaveBeenCalledWith('/auth/sign-up/email', {
      method: 'POST',
      body: { email: 'jordan@example.com', password: 'pw', name: 'Jordan' },
      unprefixed: true,
    });
  });

  it('signIn', () => {
    signIn({ email: 'jordan@example.com', password: 'pw' });

    expect(requestMock).toHaveBeenCalledWith('/auth/sign-in/email', {
      method: 'POST',
      body: { email: 'jordan@example.com', password: 'pw' },
      unprefixed: true,
    });
  });

  it('signOut sends no body', () => {
    signOut();

    expect(requestMock).toHaveBeenCalledWith('/auth/sign-out', {
      method: 'POST',
      unprefixed: true,
    });
  });

  it('getSession is bounded by a timeout, so the splash cannot hang on it', () => {
    getSession();

    expect(requestMock).toHaveBeenCalledWith('/auth/get-session', {
      unprefixed: true,
      timeoutMs: 5000,
    });
  });

  it('requestPasswordReset uses the 1.6 route name, not /forget-password', () => {
    requestPasswordReset({ email: 'jordan@example.com' });

    expect(requestMock).toHaveBeenCalledWith('/auth/request-password-reset', {
      method: 'POST',
      body: { email: 'jordan@example.com' },
      unprefixed: true,
    });
  });
});

describe('coach — two modes, and they are separate endpoints', () => {
  /**
   * QA-10. The shared transport arms an `AbortController` only when it is given a timeout, and
   * none of these passed one — so a backend that accepted the request and never answered left
   * the composer pending indefinitely, with nothing to cancel or retry. Measured at over two
   * minutes before the observation was cut short, not because it recovered.
   */
  const BOUNDED = { timeoutMs: 60_000 };

  it('requestPracticePlan posts a prompt to the planner, under a time limit', () => {
    requestPracticePlan('30 minutes of blues');

    expect(requestMock).toHaveBeenCalledWith('/ai/practice-planner', {
      method: 'POST',
      body: { prompt: '30 minutes of blues' },
      ...BOUNDED,
    });
  });

  it('resolvePracticePlan reuses the planner route with the draft id, not a prompt', () => {
    resolvePracticePlan('resp-1', true);

    expect(requestMock).toHaveBeenCalledWith('/ai/practice-planner', {
      method: 'POST',
      body: { previousResponseId: 'resp-1', confirmation: true },
      ...BOUNDED,
    });
  });

  it('resolvePracticePlan forwards a decline as confirmation: false', () => {
    resolvePracticePlan('resp-1', false);

    expect(requestMock).toHaveBeenCalledWith('/ai/practice-planner', {
      method: 'POST',
      body: { previousResponseId: 'resp-1', confirmation: false },
      ...BOUNDED,
    });
  });

  it('instantCreateRoutine hits the other endpoint entirely, also bounded', () => {
    instantCreateRoutine("what I've skipped lately");

    expect(requestMock).toHaveBeenCalledWith('/ai/routine-coach', {
      method: 'POST',
      body: { message: "what I've skipped lately" },
      ...BOUNDED,
    });
  });
});

describe('routines', () => {
  it('listRoutines defaults to an empty query rather than omitting it', () => {
    listRoutines();

    expect(requestMock).toHaveBeenCalledWith('/routines', { query: {} });
  });

  it('listRoutines forwards paging and status', () => {
    listRoutines({ page: 2, limit: 50, status: 'archived' });

    expect(requestMock).toHaveBeenCalledWith('/routines', {
      query: { page: 2, limit: 50, status: 'archived' },
    });
  });

  it('getRoutine', () => {
    getRoutine('r1');

    expect(requestMock).toHaveBeenCalledWith('/routines/r1');
  });

  it('createRoutine', () => {
    createRoutine({ title: 'Morning warm-up' });

    expect(requestMock).toHaveBeenCalledWith('/routines', {
      method: 'POST',
      body: { title: 'Morning warm-up' },
    });
  });

  it('updateRoutine patches rather than replacing', () => {
    updateRoutine('r1', { status: 'archived' });

    expect(requestMock).toHaveBeenCalledWith('/routines/r1', {
      method: 'PATCH',
      body: { status: 'archived' },
    });
  });

  it('deleteRoutine', () => {
    deleteRoutine('r1');

    expect(requestMock).toHaveBeenCalledWith('/routines/r1', { method: 'DELETE' });
  });

  it('listRoutineTasks', () => {
    listRoutineTasks('r1');

    expect(requestMock).toHaveBeenCalledWith('/routines/r1/tasks');
  });

  it('addRoutineTask', () => {
    addRoutineTask('r1', { taskId: 't1', position: 2, targetDurationMinutes: 10 });

    expect(requestMock).toHaveBeenCalledWith('/routines/r1/tasks', {
      method: 'POST',
      body: { taskId: 't1', position: 2, targetDurationMinutes: 10 },
    });
  });

  it('reorderRoutineTasks sends the whole order under taskIds', () => {
    reorderRoutineTasks('r1', ['c', 'a', 'b']);

    expect(requestMock).toHaveBeenCalledWith('/routines/r1/tasks/reorder', {
      method: 'PATCH',
      body: { taskIds: ['c', 'a', 'b'] },
    });
  });

  it('updateRoutineTask nests the task under its routine', () => {
    updateRoutineTask('r1', 't1', { position: 3 });

    expect(requestMock).toHaveBeenCalledWith('/routines/r1/tasks/t1', {
      method: 'PATCH',
      body: { position: 3 },
    });
  });

  it('removeRoutineTask', () => {
    removeRoutineTask('r1', 't1');

    expect(requestMock).toHaveBeenCalledWith('/routines/r1/tasks/t1', { method: 'DELETE' });
  });
});

describe('practice sessions — write-once, so there is no update route to test', () => {
  it('createSession', () => {
    createSession({ routineId: 'r1', tasks: [{ taskId: 't1', durationMinutes: 10 }] });

    expect(requestMock).toHaveBeenCalledWith('/practice-sessions', {
      method: 'POST',
      body: { routineId: 'r1', tasks: [{ taskId: 't1', durationMinutes: 10 }] },
    });
  });

  it('listSessions defaults its query', () => {
    listSessions();

    expect(requestMock).toHaveBeenCalledWith('/practice-sessions', { query: {} });
  });

  it('listSessions forwards paging', () => {
    listSessions({ page: 3, limit: 100 });

    expect(requestMock).toHaveBeenCalledWith('/practice-sessions', {
      query: { page: 3, limit: 100 },
    });
  });

  it('getSession', () => {
    getPracticeSession('s1');

    expect(requestMock).toHaveBeenCalledWith('/practice-sessions/s1');
  });

  it('deleteSessionsByTitle passes the title as a query, not a path segment', () => {
    deleteSessionsByTitle('Morning warm-up');

    expect(requestMock).toHaveBeenCalledWith('/practice-sessions', {
      method: 'DELETE',
      query: { title: 'Morning warm-up' },
    });
  });
});

describe('tasks — read-only for ordinary users, so only two routes exist', () => {
  it('listTasks defaults its query', () => {
    listTasks();

    expect(requestMock).toHaveBeenCalledWith('/tasks', { query: {} });
  });

  it('listTasks forwards category and difficulty filters', () => {
    listTasks({ category: 'technique', difficulty: 'easy' });

    expect(requestMock).toHaveBeenCalledWith('/tasks', {
      query: { category: 'technique', difficulty: 'easy' },
    });
  });

  it('getTask', () => {
    getTask('t1');

    expect(requestMock).toHaveBeenCalledWith('/tasks/t1');
  });
});

describe('recordings', () => {
  it('uploadRecording goes through upload(), not request()', () => {
    const file = { uri: 'file:///take-1.m4a', name: 'take-1.m4a', mimeType: 'audio/x-m4a' };
    uploadRecording('s1', file);

    expect(uploadMock).toHaveBeenCalledWith('/practice-sessions/s1/recordings', file);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('listRecordings is nested under its session', () => {
    listRecordings('s1');

    expect(requestMock).toHaveBeenCalledWith('/practice-sessions/s1/recordings');
  });

  it('getRecordingDownloadUrl is keyed by recording, not by session', () => {
    getRecordingDownloadUrl('rec-1');

    expect(requestMock).toHaveBeenCalledWith('/recordings/rec-1/download-url');
  });

  it('deleteRecording', () => {
    deleteRecording('rec-1');

    expect(requestMock).toHaveBeenCalledWith('/recordings/rec-1', { method: 'DELETE' });
  });
});
