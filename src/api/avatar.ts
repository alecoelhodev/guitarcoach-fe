import { request, type UploadFile, upload } from '@/api/client';
import type { AvatarUrl } from '@/types/user';

export function uploadAvatar(file: UploadFile) {
  return upload<AvatarUrl>('/users/me/avatar', file, 'PUT');
}

/** Signed for ~15 min; request it per display rather than storing it. */
export function getAvatarUrl() {
  return request<AvatarUrl>('/users/me/avatar');
}

export function deleteAvatar() {
  return request<void>('/users/me/avatar', { method: 'DELETE' });
}
