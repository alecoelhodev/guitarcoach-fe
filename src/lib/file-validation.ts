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

/**
 * A media type is `type/subtype` plus optional parameters, and its case is not significant
 * (RFC 9110 §8.3). Matching the raw string against the allowlist therefore rejected
 * `AUDIO/MPEG` and `audio/mpeg; codecs=mp3`, both of which are the same type — and both of
 * which a picker can legitimately hand back.
 */
function normalizeMimeType(raw: string) {
  return raw.split(';')[0]?.trim().toLowerCase() ?? '';
}

/**
 * The gate before an upload starts. It is a courtesy to the user, not a security boundary:
 * the type comes from the OS picker (or, on web, from the browser), so it is whatever the
 * caller says it is, and the server re-validates. What it buys is a 50 MB upload that fails
 * in a second rather than in a minute.
 */
export function validateRecordingFile(file: {
  mimeType?: string | null;
  size?: number | null;
}): FileValidationResult {
  const mimeType = file.mimeType ? normalizeMimeType(file.mimeType) : '';
  if (!ALLOWED_MIME_TYPES.includes(mimeType as RecordingMimeType)) {
    return { valid: false, reason: 'Unsupported file type. Use MP3, WAV, M4A, OGG, or WebM.' };
  }
  // An absent size is not a small file — `expo-document-picker` simply may not report one,
  // and letting it through is the right trade: the server enforces the real limit, and
  // guessing "too big" here would block a legitimate upload the app cannot measure.
  if (file.size != null && file.size > RECORDING_MAX_SIZE_BYTES) {
    return { valid: false, reason: 'File is larger than 50 MB.' };
  }
  return { valid: true };
}
