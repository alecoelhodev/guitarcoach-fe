const mockCopy = jest.fn(async () => undefined);
const mockRemove = jest.fn();
const mockCreate = jest.fn();
let mockExists = true;

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///doc' },
  Directory: jest.fn((parent: string, name: string) => ({
    uri: `${parent}/${name}`,
    create: mockCreate,
  })),
  File: jest.fn((parent: string | { uri: string }, name?: string) => ({
    uri: name ? `${typeof parent === 'string' ? parent : parent.uri}/${name}` : parent,
    copy: mockCopy,
    delete: mockRemove,
    get exists() {
      return mockExists;
    },
  })),
}));

import { discardClipFile, keepClipFile } from '@/features/recordings/pending-clip-files';

beforeEach(() => {
  jest.clearAllMocks();
  mockExists = true;
});

it('copies a clip out of the cache into the documents directory', async () => {
  const uri = await keepClipFile('c1', {
    uri: 'file:///cache/rec.m4a',
    name: 'recording-1.m4a',
    mimeType: 'audio/mp4',
  });

  expect(mockCreate).toHaveBeenCalledWith({ idempotent: true, intermediates: true });
  expect(mockCopy).toHaveBeenCalledWith(expect.objectContaining({ uri: uri }));
  expect(uri).toBe('file:///doc/pending-recordings/c1.m4a');
});

it('deletes a kept clip, and ignores one that is already gone', () => {
  discardClipFile('c1', 'file:///doc/pending-recordings/c1.m4a');
  expect(mockRemove).toHaveBeenCalledTimes(1);

  mockExists = false;
  discardClipFile('c2', 'file:///doc/pending-recordings/c2.m4a');
  expect(mockRemove).toHaveBeenCalledTimes(1);
});
