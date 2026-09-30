import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { describeError } from '@/api/errors';
import { queryKeys } from '@/api/query-keys';
import { listRoutineTasks } from '@/api/routines';
import { type ActiveSessionTask, useActiveSessionStore } from '@/features/session/session-store';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';
import type { Routine, RoutineTaskWithTask } from '@/types/routine';

export type StartPracticeInput = {
  routine: Pick<Routine, 'id' | 'title'>;
  /**
   * Passed when the caller already holds the routine's tasks — Home's "Today's practice"
   * card and the routine detail screen both do. The routine grid omits them and pays one
   * fetch on press rather than one per card on every Home render.
   */
  tasks?: RoutineTaskWithTask[];
};

function toActiveSessionTask(routineTask: RoutineTaskWithTask): ActiveSessionTask {
  return {
    taskId: routineTask.taskId,
    title: routineTask.task.title,
    targetDurationMinutes: routineTask.targetDurationMinutes ?? undefined,
    durationMinutes: routineTask.targetDurationMinutes ?? 0,
    completed: false,
  };
}

/**
 * Canvas 02 line 840: "Start Practice" creates nothing. It reads the routine's ordered tasks
 * and their target durations, then opens the Active Session screen pre-loaded with them; the
 * session record is written once, at Finish.
 *
 * Shared by all three entry points the canvas keeps deliberately (Home's today card, the web
 * routine grid, and the routine detail screen) so they cannot drift apart.
 */
export function useStartPractice() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const startSession = useActiveSessionStore((state) => state.start);
  // Stamped on the session so a later account cannot be offered it — the store persists
  // under one device-wide key. See `src/stores/clear-local-session.ts`.
  const userId = useSessionStore((state) => state.user?.id);
  const showToast = useToastStore((state) => state.show);

  return useMutation({
    mutationFn: async ({ routine, tasks }: StartPracticeInput) =>
      tasks ??
      queryClient.fetchQuery({
        queryKey: queryKeys.routineTasks(routine.id),
        queryFn: () => listRoutineTasks(routine.id),
      }),
    onSuccess: (tasks, { routine }) => {
      startSession({
        userId,
        routineId: routine.id,
        routineTitle: routine.title,
        // Seeded from the routine, then the user's to rename — canvas 07's "Evening practice".
        title: routine.title,
        tasks: tasks.map(toActiveSessionTask),
      });
      router.push('/session/active');
    },
    onError: (error) => {
      showToast(describeError(error, "Couldn't start practice").title, 'error');
    },
  });
}
