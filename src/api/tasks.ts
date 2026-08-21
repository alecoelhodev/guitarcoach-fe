import { request } from '@/api/client';
import type { Paginated } from '@/types/pagination';
import type { Task, TaskCategory, TaskDifficulty } from '@/types/task';

export function listTasks(
  query: {
    page?: number;
    limit?: number;
    category?: TaskCategory;
    difficulty?: TaskDifficulty;
  } = {},
) {
  return request<Paginated<Task>>('/tasks', { query });
}

export function getTask(id: string) {
  return request<Task>(`/tasks/${id}`);
}
