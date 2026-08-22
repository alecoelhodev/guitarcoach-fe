import { request } from '@/api/client';
import type { Paginated } from '@/types/pagination';
import type { PracticeSession } from '@/types/session';

/**
 * Sessions are write-once — there is no update endpoint. Finish is the last
 * chance to correct numbers (see plan/SETUP-PLAN.md "API constraints").
 */
export function createSession(input: {
  title?: string;
  notes?: string;
  routineId?: string;
  tasks?: { taskId: string; durationMinutes?: number; completed?: boolean }[];
}) {
  return request<PracticeSession>('/practice-sessions', { method: 'POST', body: input });
}

export function listSessions(query: { page?: number; limit?: number } = {}) {
  return request<Paginated<PracticeSession>>('/practice-sessions', { query });
}

export function getSession(sessionId: string) {
  return request<PracticeSession>(`/practice-sessions/${sessionId}`);
}

export function deleteSessionsByTitle(title: string) {
  return request<{ deletedCount: number }>('/practice-sessions', {
    method: 'DELETE',
    query: { title },
  });
}
