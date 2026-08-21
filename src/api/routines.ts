import { request } from '@/api/client';
import type { Paginated } from '@/types/pagination';
import type { Routine, RoutineStatus, RoutineTask, RoutineTaskWithTask } from '@/types/routine';

export function listRoutines(
  query: { page?: number; limit?: number; status?: RoutineStatus } = {},
) {
  return request<Paginated<Routine>>('/routines', { query });
}

export function getRoutine(id: string) {
  return request<Routine>(`/routines/${id}`);
}

export function createRoutine(input: { title: string; status?: RoutineStatus; notes?: string }) {
  return request<Routine>('/routines', { method: 'POST', body: input });
}

export function updateRoutine(
  id: string,
  input: Partial<{ title: string; status: RoutineStatus; notes: string }>,
) {
  return request<Routine>(`/routines/${id}`, { method: 'PATCH', body: input });
}

export function deleteRoutine(id: string) {
  return request<void>(`/routines/${id}`, { method: 'DELETE' });
}

export function listRoutineTasks(routineId: string) {
  return request<RoutineTaskWithTask[]>(`/routines/${routineId}/tasks`);
}

export function addRoutineTask(
  routineId: string,
  input: { taskId: string; position?: number; targetDurationMinutes?: number },
) {
  return request<RoutineTask>(`/routines/${routineId}/tasks`, { method: 'POST', body: input });
}

export function reorderRoutineTasks(routineId: string, taskIds: string[]) {
  return request<RoutineTask[]>(`/routines/${routineId}/tasks/reorder`, {
    method: 'PATCH',
    body: { taskIds },
  });
}

export function updateRoutineTask(
  routineId: string,
  taskId: string,
  input: Partial<{ position: number; targetDurationMinutes: number }>,
) {
  return request<RoutineTask>(`/routines/${routineId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function removeRoutineTask(routineId: string, taskId: string) {
  return request<void>(`/routines/${routineId}/tasks/${taskId}`, { method: 'DELETE' });
}
