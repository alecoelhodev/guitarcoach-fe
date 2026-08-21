import { request } from '@/api/client';
import type { DraftPlanResponse, InstantCreateResponse } from '@/types/coach';

/**
 * Draft & Review: starting a plan writes nothing until confirmed. Drafts expire
 * 15 minutes after the initial call — confirming an expired draft returns
 * { status: 'cancelled' } (see plan/SETUP-PLAN.md "API constraints").
 */
export function requestPracticePlan(prompt: string) {
  return request<DraftPlanResponse>('/ai/practice-planner', { method: 'POST', body: { prompt } });
}

export function resolvePracticePlan(previousResponseId: string, confirmation: boolean) {
  return request<DraftPlanResponse>('/ai/practice-planner', {
    method: 'POST',
    body: { previousResponseId, confirmation },
  });
}

/** Instant Create persists a routine as soon as the request succeeds — no confirmation step. */
export function instantCreateRoutine(message: string) {
  return request<InstantCreateResponse>('/ai/routine-coach', { method: 'POST', body: { message } });
}
