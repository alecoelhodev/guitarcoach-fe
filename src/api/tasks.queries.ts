import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/api/query-keys';
import { getTask, listTasks } from '@/api/tasks';
import type { TaskCategory, TaskDifficulty } from '@/types/task';

type TaskFilters = { category?: TaskCategory; difficulty?: TaskDifficulty; limit?: number };

/** Task library is a shared read-only catalog — stays fresh longer than user data. */
export function useTasks(filters: TaskFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.tasks(filters),
    queryFn: ({ pageParam }) => listTasks({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
    staleTime: 10 * 60_000,
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: queryKeys.task(taskId),
    queryFn: () => getTask(taskId),
    staleTime: 10 * 60_000,
  });
}
