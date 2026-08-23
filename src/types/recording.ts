import type { components } from '@/types/api';

export type RecordingMimeType =
  | 'audio/mpeg'
  | 'audio/wav'
  | 'audio/x-wav'
  | 'audio/mp4'
  | 'audio/x-m4a'
  | 'audio/ogg'
  | 'audio/webm';

export const RECORDING_MAX_SIZE_BYTES = 50 * 1024 * 1024;

export type Recording = components['schemas']['RecordingResponseDto'];
