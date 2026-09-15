import { useRouter } from 'expo-router';

import { useActiveSessionStore } from '@/features/session/session-store';
import type { Routine, RoutineTaskWithTask } from '@/types/routine';

/**
 * Start Practice creates nothing (canvas 05). It reads the routine's ordered tasks and their
 * target durations into local session state and opens the Active Session screen; the session
 * record is written once, at Finish. Backing out therefore costs nothing and never leaves a
 * half-finished session in History.
 *
 * Shared because canvas 05 keeps three entry points deliberately — the routine card, the
 * routine detail and Home — and they must all load the store identically.
 */
export function useStartPractice() {
  const router = useRouter();
  const startSession = useActiveSessionStore((state) => state.start);

  return (routine: Pick<Routine, 'id' | 'title'>, tasks: RoutineTaskWithTask[]) => {
    startSession({
      routineId: routine.id,
      title: routine.title,
      tasks: tasks.map((routineTask) => ({
        taskId: routineTask.taskId,
        title: routineTask.task.title,
        targetDurationMinutes: routineTask.targetDurationMinutes ?? undefined,
        durationMinutes: routineTask.targetDurationMinutes ?? 0,
        completed: false,
      })),
    });
    router.push('/session/active');
  };
}
