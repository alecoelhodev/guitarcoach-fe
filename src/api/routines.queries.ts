import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/api/query-keys';
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
import type {
  AddRoutineTaskInput,
  CreateRoutineInput,
  RoutineStatus,
  RoutineTaskWithTask,
  UpdateRoutineInput,
  UpdateRoutineTaskInput,
} from '@/types/routine';

type RoutineFilters = { status?: RoutineStatus; limit?: number };

export function useRoutines(filters: RoutineFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.routines(filters),
    queryFn: ({ pageParam }) => listRoutines({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
  });
}

/**
 * `routineId` is optional because Home derives it — it has no routine to show
 * until the session and routine lists resolve. Without the `enabled` guard the
 * empty id would be pasted straight into the URL and request `/routines/`.
 */
export function useRoutine(routineId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.routine(routineId ?? ''),
    queryFn: () => getRoutine(routineId as string),
    enabled: !!routineId,
  });
}

export function useRoutineTasks(routineId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.routineTasks(routineId ?? ''),
    queryFn: () => listRoutineTasks(routineId as string),
    enabled: !!routineId,
  });
}

/** Optimistic reorder — the one place a rollback earns its keep (drag/move can fail mid-air). */
export function useReorderRoutineTasks(routineId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.routineTasks(routineId);

  return useMutation({
    mutationFn: (taskIds: string[]) => reorderRoutineTasks(routineId, taskIds),
    onMutate: async (taskIds) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RoutineTaskWithTask[]>(queryKey);
      if (previous) {
        const byId = new Map(previous.map((task) => [task.taskId, task]));
        queryClient.setQueryData(
          queryKey,
          taskIds.map((id) => byId.get(id)).filter((task): task is RoutineTaskWithTask => !!task),
        );
      }
      return { previous };
    },
    onError: (_error, _taskIds, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * One invalidation, not three. `routinesRoot` is the first segment of every routine key —
 * list, detail and the detail's tasks — so a prefix invalidation over it reaches all of
 * them; `query-keys.test.ts` pins that nesting. Three explicit calls would be the same
 * work spelled twice more.
 *
 * Every routine write needs the root anyway: `taskCount` and `totalTargetDurationMinutes`
 * are computed server-side and sit on the *list* response, so adding a task or editing its
 * duration goes stale on the list cards too, not just on the routine being edited.
 */
function useInvalidateRoutines() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.routinesRoot });
}

export function useCreateRoutine() {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: (input: CreateRoutineInput) => createRoutine(input),
    onSuccess: invalidate,
  });
}

export function useUpdateRoutine(routineId: string) {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: (input: UpdateRoutineInput) => updateRoutine(routineId, input),
    onSuccess: invalidate,
  });
}

/** Drops the detail outright: invalidating it would refetch an id the server just deleted. */
export function useDeleteRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (routineId: string) => deleteRoutine(routineId),
    onSuccess: (_data, routineId) => {
      queryClient.removeQueries({ queryKey: queryKeys.routine(routineId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.routinesRoot });
    },
  });
}

export function useAddRoutineTask(routineId: string) {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: (input: AddRoutineTaskInput) => addRoutineTask(routineId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateRoutineTask(routineId: string) {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateRoutineTaskInput }) =>
      updateRoutineTask(routineId, taskId, input),
    onSuccess: invalidate,
  });
}

export function useRemoveRoutineTask(routineId: string) {
  const invalidate = useInvalidateRoutines();
  return useMutation({
    mutationFn: (taskId: string) => removeRoutineTask(routineId, taskId),
    onSuccess: invalidate,
  });
}
