import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/api/query-keys';
import { getRoutine, listRoutines, listRoutineTasks, reorderRoutineTasks } from '@/api/routines';
import type { RoutineStatus, RoutineTaskWithTask } from '@/types/routine';

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

export function useRoutine(routineId: string) {
  return useQuery({
    queryKey: queryKeys.routine(routineId),
    queryFn: () => getRoutine(routineId),
  });
}

export function useRoutineTasks(routineId: string) {
  return useQuery({
    queryKey: queryKeys.routineTasks(routineId),
    queryFn: () => listRoutineTasks(routineId),
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
