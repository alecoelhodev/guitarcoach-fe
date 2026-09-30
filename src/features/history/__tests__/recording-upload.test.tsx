jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@/api/recordings.queries', () => ({ useUploadRecording: jest.fn() }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';

import { ApiError } from '@/api/client';
import { useUploadRecording } from '@/api/recordings.queries';
import { RecordingUpload } from '@/features/history/recording-upload';
import { useToastStore } from '@/stores/toast-store';
import { mutationStub } from '@/test/query-hooks';
import { RECORDING_MAX_SIZE_BYTES } from '@/types/recording';

const asset = {
  uri: 'file:///take.m4a',
  name: 'take.m4a',
  mimeType: 'audio/mp4',
  size: 4096,
  lastModified: 0,
};
const pick = jest.mocked(DocumentPicker.getDocumentAsync);
let upload: ReturnType<typeof mutationStub>;

beforeEach(() => {
  jest.clearAllMocks();
  upload = mutationStub();
  (useUploadRecording as jest.Mock).mockReturnValue(upload);
  pick.mockResolvedValue({ canceled: false, assets: [asset] });
});

it('uploads a validated file to this session and reports success', async () => {
  await render(<RecordingUpload sessionId="session-42" />);
  await fireEvent.press(screen.getByText('Upload recording'));
  expect(pick).toHaveBeenCalledWith({
    type: 'audio/*',
    multiple: false,
    copyToCacheDirectory: true,
    // Web-only option, off so `uri` is not the whole file re-encoded as a data URL.
    base64: false,
  });
  expect(useUploadRecording).toHaveBeenCalledWith('session-42');
  expect(upload.mutateAsync).toHaveBeenCalledWith({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType,
    file: undefined,
  });
  expect(useToastStore.getState().toast?.message).toBe('Recording added');
  expect(screen.getByText('MP3, WAV, M4A, OGG or WebM · up to 50 MB')).toBeTruthy();
});

/**
 * QA-03. `DocumentPickerAsset.file` is web-only in SDK 57 and it is the only form a browser's
 * FormData can send as a file — dropping it here is what made every web upload come back as
 * "That file can't be uploaded" for a valid WAV.
 */
it('forwards the browser File the picker attaches on web', async () => {
  const file = new Blob(['RIFF'], { type: 'audio/wav' });
  pick.mockResolvedValue({
    canceled: false,
    assets: [{ ...asset, name: 'take.wav', mimeType: 'audio/wav', file: file as File }],
  });

  await render(<RecordingUpload sessionId="s1" />);
  await fireEvent.press(screen.getByText('Upload recording'));

  expect(upload.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ file }));
});

it.each([
  { mimeType: 'image/png' },
  { mimeType: undefined },
  { size: RECORDING_MAX_SIZE_BYTES + 1 },
])('rejects invalid metadata before any request: %j', async (overrides) => {
  pick.mockResolvedValue({ canceled: false, assets: [{ ...asset, ...overrides }] });
  await render(<RecordingUpload sessionId="s1" />);
  await fireEvent.press(screen.getByText('Upload recording'));
  expect(screen.getByText("That file can't be uploaded")).toBeTruthy();
  expect(upload.mutateAsync).not.toHaveBeenCalled();
  pick.mockResolvedValue({ canceled: false, assets: [asset] });
  await fireEvent.press(screen.getByText('Choose another'));
  expect(upload.mutateAsync).toHaveBeenCalledTimes(1);
});

it('allows the exact size limit', async () => {
  pick.mockResolvedValue({
    canceled: false,
    assets: [{ ...asset, size: RECORDING_MAX_SIZE_BYTES }],
  });
  await render(<RecordingUpload sessionId="s1" />);
  await fireEvent.press(screen.getByText('Upload recording'));
  expect(upload.mutateAsync).toHaveBeenCalledTimes(1);
});

it('does nothing when picking is cancelled', async () => {
  pick.mockResolvedValue({ canceled: true, assets: null });
  await render(<RecordingUpload sessionId="s1" />);
  await fireEvent.press(screen.getByText('Upload recording'));
  expect(upload.mutateAsync).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText('Upload recording')).toBeEnabled();
});

it('handles an empty picker result and a picker failure', async () => {
  pick.mockResolvedValue({ canceled: false, assets: [] });
  await render(<RecordingUpload sessionId="s1" />);
  await fireEvent.press(screen.getByText('Upload recording'));
  expect(screen.getByText("That file can't be uploaded")).toBeTruthy();
  pick.mockRejectedValue(new Error('picker unavailable'));
  await fireEvent.press(screen.getByText('Choose another'));
  expect(screen.getByText("Couldn't open the file picker")).toBeTruthy();
  expect(upload.mutateAsync).not.toHaveBeenCalled();
});

it('retains the selected file for retry without re-opening the picker', async () => {
  upload.mutateAsync.mockRejectedValueOnce(new Error('offline'));
  await render(<RecordingUpload sessionId="s1" />);
  await fireEvent.press(screen.getByText('Upload recording'));
  expect(screen.getByText("Upload didn't finish")).toBeTruthy();
  expect(useToastStore.getState().toast).toBeNull();
  await fireEvent.press(screen.getByText('Retry upload'));
  expect(upload.mutateAsync).toHaveBeenCalledTimes(2);
  expect(upload.mutateAsync.mock.calls[1]).toEqual(upload.mutateAsync.mock.calls[0]);
  expect(pick).toHaveBeenCalledTimes(1);
  expect(useToastStore.getState().toast?.message).toBe('Recording added');
});

it.each([400, 413])('allows choosing another file after server rejection %s', async (status) => {
  upload.mutateAsync.mockRejectedValue(new ApiError('rejected', status));
  await render(<RecordingUpload sessionId="s1" />);
  await fireEvent.press(screen.getByText('Upload recording'));
  expect(screen.getByText("That file can't be uploaded")).toBeTruthy();
  expect(screen.getByText('Choose another')).toBeTruthy();
});

it('shows indeterminate progress and prevents duplicate uploads while pending', async () => {
  let finish!: () => void;
  upload.mutateAsync.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await render(<RecordingUpload sessionId="s1" />);
  await fireEvent.press(screen.getByText('Upload recording'));
  expect(screen.getByRole('progressbar', { name: 'Uploading recording' })).toBeTruthy();
  expect(screen.getByText('Uploading take.m4a…')).toBeTruthy();
  expect(screen.queryByText(/Cancel upload|\d+%/)).toBeNull();
  expect(screen.getByText('Upload recording')).toBeDisabled();
  await fireEvent.press(screen.getByText('Upload recording'));
  expect(upload.mutateAsync).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
  });
  expect(screen.queryByRole('progressbar')).toBeNull();
});
