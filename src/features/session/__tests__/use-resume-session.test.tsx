jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());

import { act, renderHook } from '@testing-library/react-native';

import { useActiveSessionStore } from '@/features/session/session-store';
import { resumedElapsedSeconds, useResumeSession } from '@/features/session/use-resume-session';
import { useSessionStore } from '@/stores/session-store';
import { mockRouter } from '@/test/expo-router';
import { makeSession, makeSessionTask, makeUser } from '@/test/fixtures';

describe('resumedElapsedSeconds', () => {
  it('uses the stored time', () => {
    expect(resumedElapsedSeconds(makeSession({ durationSeconds: 75 }))).toBe(75);
  });

  it('falls back to the task minutes for a session saved before the time was stored', () => {
    const session = makeSession({
      sessionTasks: [
        makeSessionTask({ taskId: 'a', durationMinutes: 3 }),
        makeSessionTask({ taskId: 'b', durationMinutes: null }),
      ],
    });
    expect(resumedElapsedSeconds(session)).toBe(180);
  });
});

it('loads the saved session into the session screen and opens it', async () => {
  useSessionStore.setState({ status: 'authenticated', user: makeUser({ id: 'u1' }) });
  const session = makeSession({
    id: 's1',
    routineId: 'r1',
    title: 'Evening',
    notes: null,
    durationSeconds: 60,
    sessionTasks: [makeSessionTask({ taskId: 't1', durationMinutes: null, completed: true })],
  });
  const { result } = await renderHook(() => useResumeSession());

  await act(async () => result.current(session));

  expect(useActiveSessionStore.getState()).toMatchObject({
    userId: 'u1',
    sessionId: 's1',
    routineId: 'r1',
    title: 'Evening',
    notes: undefined,
    tasks: [expect.objectContaining({ taskId: 't1', durationMinutes: 0, completed: true })],
  });
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/session/active',
    params: { from: 'history' },
  });
});
