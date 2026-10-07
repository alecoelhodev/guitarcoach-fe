import { apiPath, request } from '@/api/client';
import type { Paginated } from '@/types/pagination';
import type {
  CreateTaskInput,
  Task,
  TaskCategory,
  TaskDifficulty,
  UpdateTaskInput,
} from '@/types/task';

export function listTasks(
  query: {
    page?: number;
    limit?: number;
    category?: TaskCategory;
    difficulty?: TaskDifficulty;
    q?: string;
  } = {},
) {
  return request<Paginated<Task>>('/tasks', { query });
}

export function getTask(id: string) {
  return request<Task>(apiPath`/tasks/${id}`);
}

/** Admin-only: the backend answers 403 for everyone else. */
export function createTask(input: CreateTaskInput) {
  return request<Task>('/tasks', { method: 'POST', body: input });
}

/** Admin-only. */
export function updateTask(id: string, input: UpdateTaskInput) {
  return request<Task>(apiPath`/tasks/${id}`, { method: 'PATCH', body: input });
}

/** Admin-only. A 409 while any routine or logged session still uses the task. */
export function deleteTask(id: string) {
  return request<void>(apiPath`/tasks/${id}`, { method: 'DELETE' });
}

/** Admin-only. 1–10 tasks, created together or not at all. */
export function bulkCreateTasks(tasks: CreateTaskInput[]) {
  return request<Task[]>('/tasks/bulk', { method: 'POST', body: { tasks } });
}
