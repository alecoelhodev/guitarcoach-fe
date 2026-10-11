jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

import { createAudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';

import {
  DURATION_TIMEOUT_MS,
  pickRecordingFile,
  RecordingRejected,
  readDurationSeconds,
} from '@/features/recordings/pick-recording';

const asset = {
  uri: 'file:///take.m4a',
  name: 'take.m4a',
  mimeType: 'audio/mp4',
  size: 1,
  lastModified: 0,
};
const pick = jest.mocked(DocumentPicker.getDocumentAsync);

/** A player that reports `duration` once loaded, or never loads when it is `undefined`. */
function playerReporting(duration: number | undefined) {
  const player = {
    addListener: jest.fn((_event: string, listener: (status: object) => void) => {
      if (duration !== undefined) {
        void Promise.resolve().then(() => listener({ isLoaded: true, duration }));
      }
      return { remove: jest.fn() };
    }),
    release: jest.fn(),
  };
  jest.mocked(createAudioPlayer).mockReturnValueOnce(player as never);
  return player;
}

beforeEach(() => {
  jest.clearAllMocks();
  pick.mockResolvedValue({ canceled: false, assets: [asset] });
});

it('resolves null when the user cancels', async () => {
  pick.mockResolvedValue({ canceled: true, assets: null });
  await expect(pickRecordingFile()).resolves.toBeNull();
});

it('returns the file with its length', async () => {
  playerReporting(12.4);
  await expect(pickRecordingFile()).resolves.toEqual({
    file: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType, file: undefined },
    seconds: 12.4,
  });
});

it('refuses a clip over 30 seconds and says how long it is', async () => {
  playerReporting(72);
  await expect(pickRecordingFile()).rejects.toThrow(
    new RecordingRejected('Clips can be up to 30 seconds — this one is 1:12.'),
  );
});

// The recorder's own cap can land a fraction over 30 s.
it('accepts a clip that rounds to 30 seconds', async () => {
  playerReporting(30.4);
  await expect(pickRecordingFile()).resolves.toMatchObject({ seconds: 30.4 });
});

it('refuses a wrong type before measuring it', async () => {
  pick.mockResolvedValue({ canceled: false, assets: [{ ...asset, mimeType: 'image/png' }] });
  await expect(pickRecordingFile()).rejects.toThrow(
    'Unsupported file type. Use MP3, WAV, M4A, OGG, or WebM.',
  );
  expect(createAudioPlayer).not.toHaveBeenCalled();
});

describe('readDurationSeconds', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('gives up on a file it cannot measure, and frees the player', async () => {
    const player = playerReporting(undefined);
    const reading = readDurationSeconds('file:///odd.ogg');

    jest.advanceTimersByTime(DURATION_TIMEOUT_MS);

    await expect(reading).resolves.toBeUndefined();
    expect(player.release).toHaveBeenCalledTimes(1);
  });
});
