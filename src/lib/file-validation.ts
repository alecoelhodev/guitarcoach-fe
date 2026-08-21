import { RECORDING_MAX_SIZE_BYTES, type RecordingMimeType } from '@/types/recording';

const ALLOWED_MIME_TYPES: readonly RecordingMimeType[] = [
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
];

export type FileValidationResult = { valid: true } | { valid: false; reason: string };

export function validateRecordingFile(file: {
  mimeType?: string | null;
  size?: number | null;
}): FileValidationResult {
  if (!file.mimeType || !ALLOWED_MIME_TYPES.includes(file.mimeType as RecordingMimeType)) {
    return { valid: false, reason: 'Unsupported file type. Use MP3, WAV, M4A, OGG, or WebM.' };
  }
  if (file.size != null && file.size > RECORDING_MAX_SIZE_BYTES) {
    return { valid: false, reason: 'File is larger than 50 MB.' };
  }
  return { valid: true };
}
