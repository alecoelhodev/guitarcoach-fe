import { request } from '@/api/client';
import type { User } from '@/types/user';

/**
 * better-auth mounts its own handler outside Nest's decorator metadata and the global
 * prefix excludes `/auth/*`, so these routes never reach `@nestjs/swagger` and are absent
 * from `openapi.json`. That makes this the one file where request/response shapes are
 * hand-written instead of re-exported from `src/types/api.d.ts` — verified against
 * better-auth 1.6.25's own route definitions, not from memory.
 */

export function signUp(input: { email: string; password: string; name: string }) {
  return request<{ user: User }>('/auth/sign-up/email', {
    method: 'POST',
    body: input,
    unprefixed: true,
  });
}

export function signIn(input: { email: string; password: string }) {
  return request<{ user: User }>('/auth/sign-in/email', {
    method: 'POST',
    body: input,
    unprefixed: true,
  });
}

export function signOut() {
  return request<void>('/auth/sign-out', { method: 'POST', unprefixed: true });
}

export function getSession() {
  return request<{ user: User } | null>('/auth/get-session', { unprefixed: true });
}

/**
 * Named `/request-password-reset` since better-auth 1.6 — `/forget-password` was removed
 * and now only exists on the email-OTP plugin. Always resolves with the same neutral
 * message whether or not the account exists, and the server does dummy token work to
 * equalize timing; callers must not distinguish the two cases.
 */
export function requestPasswordReset(input: { email: string }) {
  return request<{ status: boolean; message: string }>('/auth/request-password-reset', {
    method: 'POST',
    body: input,
    unprefixed: true,
  });
}
