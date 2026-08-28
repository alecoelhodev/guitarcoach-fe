import type { components } from '@/types/api';

// The session user (from /auth/sign-in, /auth/sign-up, /auth/get-session,
// and /users/me) — better-auth's own canonical shape, which exposes `name`,
// not the `displayName` column it's mapped to under the hood (see auth.ts's
// `fields: { name: 'displayName' }` and MeResponseDto's comment on the
// backend). Distinct from the admin-only UserResponseDto.
export type User = components['schemas']['MeResponseDto'];
