import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import type { UploadFile } from '@/api/client';

/** Comfortably sharp at the 66pt avatar on a 3× screen, and far under the 2 MB limit. */
const AVATAR_PX = 512;

/**
 * Library only, square-cropped, re-encoded as a JPEG at most 512 px wide. Resolves `null`
 * when the user cancels. iOS's photo picker runs out of process and needs no permission.
 */
export async function pickAvatar(): Promise<UploadFile | null> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;

  const source = ImageManipulator.manipulate(asset.uri);
  const context = asset.width > AVATAR_PX ? source.resize({ width: AVATAR_PX }) : source;
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

  return {
    uri: saved.uri,
    name: 'avatar.jpg',
    mimeType: 'image/jpeg',
    // A browser's FormData needs the bytes; React Native's takes the `uri` (see UploadFile).
    file: process.env.EXPO_OS === 'web' ? await (await fetch(saved.uri)).blob() : undefined,
  };
}
