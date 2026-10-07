import type { components } from '@/types/api';

// The session user (from /auth/sign-in, /auth/sign-up, /auth/get-session,
// and /users/me) — better-auth's own canonical shape, which exposes `name`,
// not the `displayName` column it's mapped to under the hood (see auth.ts's
// `fields: { name: 'displayName' }` and MeResponseDto's comment on the
// backend). Distinct from the admin-only UserResponseDto.
export type User = components['schemas']['MeResponseDto'];

/**
 * `User.image` is the photo's storage object name, not something to render — it only says
 * that a photo is set. The URL comes from `GET /users/me/avatar` and expires.
 */
export type AvatarUrl = components['schemas']['AvatarUrlResponseDto'];
