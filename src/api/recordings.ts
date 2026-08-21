import { request, upload } from '@/api/client';
import type { Recording } from '@/types/recording';

export function uploadRecording(
  sessionId: string,
  file: { uri: string; name: string; mimeType: string },
) {
  return upload<Recording>(`/practice-sessions/${sessionId}/recordings`, file);
}

export function listRecordings(sessionId: string) {
  return request<Recording[]>(`/practice-sessions/${sessionId}/recordings`);
}

/**
 * Playback URL is temporary (~15 min TTL) and requested per play — an expired-link
 * state is a real state, not an edge case.
 */
export function getRecordingDownloadUrl(recordingId: string) {
  return request<{ url: string }>(`/recordings/${recordingId}/download-url`);
}

export function deleteRecording(recordingId: string) {
  return request<void>(`/recordings/${recordingId}`, { method: 'DELETE' });
}
