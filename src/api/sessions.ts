import { apiPath, request } from '@/api/client';
import type { Paginated } from '@/types/pagination';
import type { CreateSessionInput, PracticeSession, UpdateSessionInput } from '@/types/session';

/** Written on Finish. A resumed session's Finish goes through `updateSession` instead. */
export function createSession(input: CreateSessionInput) {
  return request<PracticeSession>('/practice-sessions', { method: 'POST', body: input });
}

/** Overwrites the fields sent; `tasks` replaces the whole list, `null` clears title or notes. */
export function updateSession(sessionId: string, input: UpdateSessionInput) {
  return request<PracticeSession>(apiPath`/practice-sessions/${sessionId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function listSessions(query: { page?: number; limit?: number } = {}) {
  return request<Paginated<PracticeSession>>('/practice-sessions', { query });
}

export function getSession(sessionId: string) {
  return request<PracticeSession>(apiPath`/practice-sessions/${sessionId}`);
}

export function deleteSessionsByTitle(title: string) {
  return request<{ deletedCount: number }>('/practice-sessions', {
    method: 'DELETE',
    query: { title },
  });
}
