import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { queryKeys } from '@/api/query-keys';
import { createTask, deleteTask, getTask, listTasks, updateTask } from '@/api/tasks';
import type { CreateTaskInput, TaskCategory, TaskDifficulty, UpdateTaskInput } from '@/types/task';

type TaskFilters = {
  category?: TaskCategory;
  difficulty?: TaskDifficulty;
  /** Title search, already trimmed; omit rather than send `''`, which the API rejects. */
  q?: string;
  limit?: number;
};

/**
 * Task library is a shared read-only catalog — stays fresh longer than user data. A filter
 * change keeps the previous list on screen until the new one lands, instead of dropping the
 * list for a loading state.
 */
export function useTasks(filters: TaskFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.tasks(filters),
    queryFn: ({ pageParam }) => listTasks({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: queryKeys.task(taskId),
    queryFn: () => getTask(taskId),
    staleTime: 10 * 60_000,
  });
}

/** Invalidates every task list: the new task can land on any page of any filter. */
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot }),
  });
}

/** Routines and sessions embed the task's title, so their cached copies go stale too. */
export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => updateTask(taskId, input),
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.task(taskId), task);
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.routinesRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessionsRoot });
    },
  });
}

/** Drops the detail outright: invalidating it would refetch an id the server just deleted. */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: (_data, taskId) => {
      queryClient.removeQueries({ queryKey: queryKeys.task(taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksRoot });
    },
  });
}
