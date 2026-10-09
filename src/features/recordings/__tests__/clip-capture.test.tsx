import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { ClipCapture } from '@/features/recordings/clip-capture';
import { MAX_CLIP_SECONDS } from '@/features/recordings/clip-limit';

type Recorder = ReturnType<typeof useAudioRecorder>;

let recorder: {
  prepareToRecordAsync: jest.Mock;
  record: jest.Mock;
  stop: jest.Mock;
  getStatus: jest.Mock;
  uri: string | null;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  recorder = {
    prepareToRecordAsync: jest.fn(async () => undefined),
    record: jest.fn(),
    stop: jest.fn(async () => undefined),
    getStatus: jest.fn(() => ({ durationMillis: 12_000 })),
    uri: 'file:///cache/rec.m4a',
  };
  jest.mocked(useAudioRecorder).mockReturnValue(recorder as unknown as Recorder);
  jest.mocked(requestRecordingPermissionsAsync).mockResolvedValue({ granted: true } as never);
});

afterEach(() => jest.useRealTimers());

async function startRecording() {
  await act(async () => {
    await fireEvent.press(screen.getByText('Record'));
  });
}

it('records a clip and hands it over as audio/mp4 on Stop', async () => {
  const onClip = jest.fn();
  jest
    .mocked(useAudioRecorderState)
    .mockReturnValue({ isRecording: true, durationMillis: 12_000 } as never);
  await render(<ClipCapture onClip={onClip} />);

  await startRecording();

  expect(setAudioModeAsync).toHaveBeenCalledWith({
    allowsRecording: true,
    playsInSilentMode: true,
  });
  expect(recorder.record).toHaveBeenCalledTimes(1);
  expect(screen.getByText('0:12 / 0:30')).toBeTruthy();

  await act(async () => {
    await fireEvent.press(screen.getByLabelText('Stop recording'));
  });

  expect(recorder.stop).toHaveBeenCalledTimes(1);
  expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
  expect(onClip).toHaveBeenCalledWith({
    file: {
      uri: 'file:///cache/rec.m4a',
      name: expect.stringMatching(/^recording-.+\.m4a$/),
      mimeType: 'audio/mp4',
      file: undefined,
    },
    seconds: 12,
  });
  expect(screen.getByText('Record')).toBeTruthy();
});

it(`stops by itself at ${MAX_CLIP_SECONDS} seconds`, async () => {
  const onClip = jest.fn();
  recorder.getStatus.mockReturnValue({ durationMillis: 30_100 });
  await render(<ClipCapture onClip={onClip} />);
  await startRecording();

  await act(async () => {
    jest.advanceTimersByTime(MAX_CLIP_SECONDS * 1000);
  });

  expect(recorder.stop).toHaveBeenCalledTimes(1);
  expect(onClip).toHaveBeenCalledWith(expect.objectContaining({ seconds: MAX_CLIP_SECONDS }));
});

it('says how to turn the microphone on when access is refused', async () => {
  jest.mocked(requestRecordingPermissionsAsync).mockResolvedValue({ granted: false } as never);
  await render(<ClipCapture onClip={jest.fn()} />);

  await startRecording();

  expect(screen.getByText('Microphone access is off — enable it in Settings.')).toBeTruthy();
  expect(recorder.record).not.toHaveBeenCalled();
});

it('reports a recorder that fails to start', async () => {
  recorder.prepareToRecordAsync.mockRejectedValue(new Error('busy'));
  await render(<ClipCapture onClip={jest.fn()} />);

  await startRecording();

  expect(screen.getByText("Recording didn't work. Try again.")).toBeTruthy();
});

it('reports a recording that left no file', async () => {
  recorder.uri = null;
  const onClip = jest.fn();
  await render(<ClipCapture onClip={onClip} />);
  await startRecording();

  await act(async () => {
    await fireEvent.press(screen.getByLabelText('Stop recording'));
  });

  expect(onClip).not.toHaveBeenCalled();
  expect(screen.getByText("Recording didn't work. Try again.")).toBeTruthy();
});
