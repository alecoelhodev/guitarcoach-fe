import { useRouter } from 'expo-router';

import { useActiveSessionStore } from '@/features/session/session-store';
import { sumSessionMinutes } from '@/lib/duration';
import { useSessionStore } from '@/stores/session-store';
import type { PracticeSession } from '@/types/session';

/**
 * Sessions saved before the elapsed time was stored carry none, so their clock restarts from
 * the minutes logged on their tasks.
 */
export function resumedElapsedSeconds(session: PracticeSession) {
  return session.durationSeconds ?? sumSessionMinutes(session) * 60;
}

/** Reopens a saved session on the Active Session screen; Finish then updates it. */
export function useResumeSession() {
  const router = useRouter();
  const resume = useActiveSessionStore((state) => state.resume);
  const userId = useSessionStore((state) => state.user?.id);

  return (session: PracticeSession) => {
    resume({
      userId,
      sessionId: session.id,
      routineId: session.routineId ?? undefined,
      title: session.title ?? undefined,
      notes: session.notes ?? undefined,
      tasks: session.sessionTasks.map((task) => ({
        taskId: task.taskId,
        title: task.task.title,
        durationMinutes: task.durationMinutes ?? 0,
        completed: task.completed,
      })),
      elapsedSeconds: resumedElapsedSeconds(session),
    });
    // Tells Finish its History page is right underneath, so it goes back rather than opening
    // a second copy. A resume from Home's prompt after a restart has no such page below.
    router.push({ pathname: '/session/active', params: { from: 'history' } });
  };
}
