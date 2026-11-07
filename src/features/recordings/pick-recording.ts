import { createAudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';

import type { UploadFile } from '@/api/client';
import { MAX_CLIP_SECONDS } from '@/features/recordings/clip-limit';
import { formatClock } from '@/lib/duration';
import { validateRecordingFile } from '@/lib/file-validation';

/** How long to wait for a picked file's length before letting it through unmeasured. */
export const DURATION_TIMEOUT_MS = 5_000;

/** A file the user picked that cannot be attached; `message` says why, in the user's terms. */
export class RecordingRejected extends Error {}

export type Clip = { file: UploadFile; seconds?: number };

/**
 * Loads the file into a throwaway player just to read its length. Resolves `undefined` when the
 * length can't be read in time: the cap is a frontend convenience, so an unmeasurable file is
 * let through rather than blocked.
 */
export function readDurationSeconds(uri: string): Promise<number | undefined> {
  const player = createAudioPlayer(uri);
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(undefined), DURATION_TIMEOUT_MS);
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded && status.duration > 0) finish(status.duration);
    });
    function finish(seconds: number | undefined) {
      clearTimeout(timer);
      subscription.remove();
      player.release();
      resolve(seconds);
    }
  });
}

/** Resolves `null` when the user cancels; rejects with `RecordingRejected` for a file we refuse. */
export async function pickRecordingFile(): Promise<Clip | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: false,
    copyToCacheDirectory: true,
    // Web-only, and it defaults to `true`: with base64 on, `asset.uri` is the whole file
    // re-encoded as a data URL — up to 50 MB of string we never read, because the browser
    // path uploads `asset.file` instead.
    base64: false,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const check = asset ? validateRecordingFile(asset) : undefined;
  if (!asset?.mimeType || !check?.valid) {
    throw new RecordingRejected(
      check && !check.valid
        ? check.reason
        : 'Unsupported file type. Use MP3, WAV, M4A, OGG, or WebM.',
    );
  }

  const seconds = await readDurationSeconds(asset.uri);
  // Rounded so a 30.2 s clip — what the recorder's own cap can produce — is not refused.
  if (seconds !== undefined && Math.round(seconds) > MAX_CLIP_SECONDS) {
    throw new RecordingRejected(
      `Clips can be up to ${MAX_CLIP_SECONDS} seconds — this one is ${formatClock(seconds)}.`,
    );
  }

  return {
    file: {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
      // Web only, and the only form a browser's FormData can send as a file.
      file: asset.file,
    },
    seconds,
  };
}
