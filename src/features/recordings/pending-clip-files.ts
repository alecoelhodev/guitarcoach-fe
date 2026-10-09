import { Directory, File, Paths } from 'expo-file-system';

import type { UploadFile } from '@/api/client';

/**
 * A browser's picked or recorded clip is a `Blob` behind a `blob:` URL, neither of which
 * survives a reload or fits in AsyncStorage, so web clips live here for the tab's lifetime.
 */
const webBlobs = new Map<string, Blob>();

/**
 * Moves a clip somewhere it will still be at Finish. The recorder and the picker both write to
 * the cache directory, which the OS may purge while a session is left open; the document
 * directory it is copied to is not. Returns the uri to keep.
 */
export async function keepClipFile(id: string, file: UploadFile): Promise<string> {
  if (process.env.EXPO_OS === 'web') {
    if (file.file) webBlobs.set(id, file.file);
    return file.uri;
  }
  const directory = new Directory(Paths.document, 'pending-recordings');
  directory.create({ idempotent: true, intermediates: true });
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'audio';
  const target = new File(directory, `${id}.${extension}`);
  await new File(file.uri).copy(target);
  return target.uri;
}

/** The web `Blob` for a kept clip; always `undefined` on native, which uploads the uri. */
export function clipBlob(id: string) {
  return webBlobs.get(id);
}

export function discardClipFile(id: string, uri: string) {
  webBlobs.delete(id);
  if (process.env.EXPO_OS === 'web') return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
