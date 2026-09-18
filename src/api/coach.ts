import { request } from '@/api/client';
import type { DraftPlanResponse, InstantCreateResponse } from '@/types/coach';

/**
 * Generation is an LLM round-trip, so the ceiling is generous — but it is a ceiling. Without
 * one the shared transport arms no `AbortController` at all, and a backend that accepted the
 * request and never answered left the composer spinning with nothing to press: measured at
 * over two minutes against a proxy that simply held the connection open.
 *
 * The abort surfaces as the same offline `ApiError` as an unreachable server, which the
 * screen already knows how to show and retry.
 */
const AI_TIMEOUT_MS = 60_000;

/**
 * Draft & Review: starting a plan writes nothing until confirmed. Drafts expire
 * 15 minutes after the initial call — confirming an expired draft returns
 * { status: 'cancelled' } (see plan/SETUP-PLAN.md "API constraints").
 */
export function requestPracticePlan(prompt: string) {
  return request<DraftPlanResponse>('/ai/practice-planner', {
    method: 'POST',
    body: { prompt },
    timeoutMs: AI_TIMEOUT_MS,
  });
}

export function resolvePracticePlan(previousResponseId: string, confirmation: boolean) {
  return request<DraftPlanResponse>('/ai/practice-planner', {
    method: 'POST',
    body: { previousResponseId, confirmation },
    timeoutMs: AI_TIMEOUT_MS,
  });
}

/** Instant Create persists a routine as soon as the request succeeds — no confirmation step. */
export function instantCreateRoutine(message: string) {
  return request<InstantCreateResponse>('/ai/routine-coach', {
    method: 'POST',
    body: { message },
    timeoutMs: AI_TIMEOUT_MS,
  });
}
