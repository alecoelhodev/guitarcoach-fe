import { validateRecordingFile } from '@/lib/file-validation';
import { RECORDING_MAX_SIZE_BYTES } from '@/types/recording';

const UNSUPPORTED_TYPE = 'Unsupported file type. Use MP3, WAV, M4A, OGG, or WebM.';
const TOO_LARGE = 'File is larger than 50 MB.';

describe('validateRecordingFile', () => {
  it.each([
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg',
    'audio/webm',
  ])('accepts %s', (mimeType) => {
    expect(validateRecordingFile({ mimeType, size: 1024 })).toEqual({ valid: true });
  });

  it.each([
    ['a type outside the allowlist', 'video/mp4'],
    ['a missing type', undefined],
    ['a null type', null],
    ['an empty type', ''],
  ])('rejects %s', (_label, mimeType) => {
    expect(validateRecordingFile({ mimeType, size: 1024 })).toEqual({
      valid: false,
      reason: UNSUPPORTED_TYPE,
    });
  });

  it('matches the allowlist exactly — case and parameters both matter', () => {
    // A picker that reports `audio/mpeg; codecs=mp3` or an uppercased type is rejected.
    // Recorded as current behaviour; both are plausible inputs from a real file picker.
    expect(validateRecordingFile({ mimeType: 'AUDIO/MPEG' }).valid).toBe(false);
    expect(validateRecordingFile({ mimeType: 'audio/mpeg; codecs=mp3' }).valid).toBe(false);
  });

  it('accepts a file exactly at the size cap', () => {
    // The comparison is `>`, so 50 MB on the nose is allowed.
    expect(
      validateRecordingFile({ mimeType: 'audio/mpeg', size: RECORDING_MAX_SIZE_BYTES }),
    ).toEqual({ valid: true });
  });

  it('rejects a file one byte over the cap', () => {
    expect(
      validateRecordingFile({ mimeType: 'audio/mpeg', size: RECORDING_MAX_SIZE_BYTES + 1 }),
    ).toEqual({ valid: false, reason: TOO_LARGE });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('skips the size check entirely when size is %s', (_label, size) => {
    // So a file of unknown length passes however large it is. The upload flow this guards
    // is not built yet; worth deciding before it is.
    expect(validateRecordingFile({ mimeType: 'audio/mpeg', size })).toEqual({ valid: true });
  });

  it('reports the type problem first when a file is both unsupported and oversized', () => {
    expect(
      validateRecordingFile({ mimeType: 'video/mp4', size: RECORDING_MAX_SIZE_BYTES * 2 }),
    ).toEqual({ valid: false, reason: UNSUPPORTED_TYPE });
  });
});
