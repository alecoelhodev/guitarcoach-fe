import { request } from '@/api/client';
import type { User } from '@/types/user';

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

export function getMe() {
  return request<User>('/users/me');
}
