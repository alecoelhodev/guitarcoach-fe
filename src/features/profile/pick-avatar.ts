import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import type { UploadFile } from '@/api/client';

/** Comfortably sharp at the 66pt avatar on a 3× screen, and far under the 2 MB limit. */
const AVATAR_PX = 512;

/** A resize of one photo takes well under a second; past this it is stuck, not slow. */
export const PREPARE_TIMEOUT_MS = 20_000;

/** Metro-only step log for diagnosing a pick on a device. Never carries URIs or user data. */
function trace(step: string) {
  // eslint-disable-next-line no-console -- dev-only diagnostics, stripped from release builds
  if (__DEV__) console.log(`[avatar] ${step}`);
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Preparing the photo timed out')), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

async function toUploadFile(uri: string, width: number): Promise<UploadFile> {
  trace(`resize:start w=${width}`);
  const source = ImageManipulator.manipulate(uri);
  const context = width > AVATAR_PX ? source.resize({ width: AVATAR_PX }) : source;
  const rendered = await context.renderAsync();
  trace('resize:done');
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  trace('save:done');

  return {
    uri: saved.uri,
    name: 'avatar.jpg',
    mimeType: 'image/jpeg',
    // A browser's FormData needs the bytes; React Native's takes the `uri` (see UploadFile).
    file: process.env.EXPO_OS === 'web' ? await (await fetch(saved.uri)).blob() : undefined,
  };
}

/**
 * Library only, square-cropped, re-encoded as a JPEG at most 512 px wide. Resolves `null`
 * only when the user cancels; anything else that goes wrong rejects, so the screen can say
 * so. `onPicked` fires once a photo is chosen, before the resize, so the screen can show
 * that work is under way. iOS's photo picker runs out of process and needs no permission.
 */
export async function pickAvatar(onPicked?: () => void): Promise<UploadFile | null> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
  });
  trace(`picker:result canceled=${result.canceled} assets=${result.assets?.length ?? 0}`);
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) throw new Error('The picker returned no photo');

  onPicked?.();
  return withTimeout(toUploadFile(asset.uri, asset.width), PREPARE_TIMEOUT_MS);
}
