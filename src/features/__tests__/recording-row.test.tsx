jest.mock('@/api/recordings', () => ({ getRecordingDownloadUrl: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { getRecordingDownloadUrl } from '@/api/recordings';
import { RecordingRow } from '@/features/history/recording-row';
import { makeRecording } from '@/test/fixtures';

/**
 * `expo-audio` is mocked globally in `jest.setup.ts` — it ships no `mocks/` directory for
 * jest-expo to pick up and dereferences its native module at import, so without that mock
 * this file cannot even be imported. Here the two hooks are re-pointed per test to drive the
 * playback states.
 *
 * The download URL is re-requested on every play because it expires, so the expired-link
 * branch is a real state rather than an edge case.
 */

const getUrlMock = getRecordingDownloadUrl as jest.MockedFunction<typeof getRecordingDownloadUrl>;
const useAudioPlayerMock = useAudioPlayer as jest.MockedFunction<typeof useAudioPlayer>;
const useAudioPlayerStatusMock = useAudioPlayerStatus as jest.MockedFunction<
  typeof useAudioPlayerStatus
>;

const player = { play: jest.fn(), pause: jest.fn(), replace: jest.fn() };

type Status = {
  playing?: boolean;
  isLoaded?: boolean;
  currentTime?: number;
  duration?: number;
};

function setStatus(status: Status = {}) {
  useAudioPlayerStatusMock.mockReturnValue({
    playing: false,
    isLoaded: false,
    currentTime: 0,
    duration: 0,
    ...status,
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAudioPlayerMock.mockReturnValue(player as never);
  setStatus();
  getUrlMock.mockResolvedValue({ url: 'https://cdn.example.com/take-1.m4a' });
});

describe('RecordingRow', () => {
  it('describes the file by format, size and time', async () => {
    await render(
      <RecordingRow
        recording={makeRecording({
          originalFileName: 'take-1.m4a',
          contentType: 'audio/x-m4a',
          sizeBytes: 4_404_019,
        })}
      />,
    );

    expect(screen.getByText('take-1.m4a')).toBeTruthy();
    // `x-` is stripped and the subtype uppercased; size is one decimal place of MiB. The time
    // is matched loosely because `toLocaleTimeString(undefined, …)` follows Node's default
    // locale, which the TZ pin does not fix.
    expect(screen.getByText(/^M4A · 4\.2 MB · /)).toBeTruthy();
  });

  it('uppercases a subtype that has no x- prefix', async () => {
    await render(
      <RecordingRow recording={makeRecording({ contentType: 'audio/mpeg', sizeBytes: 1024 })} />,
    );

    expect(screen.getByText(/^MPEG · 0\.0 MB · /)).toBeTruthy();
  });

  it('fetches a fresh URL on every play, because the last one may have expired', async () => {
    await render(<RecordingRow recording={makeRecording({ id: 'rec-9' })} />);

    await fireEvent.press(screen.getByLabelText('Play recording'));

    expect(getUrlMock).toHaveBeenCalledWith('rec-9');
    expect(player.replace).toHaveBeenCalledWith('https://cdn.example.com/take-1.m4a');
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('pauses instead of re-fetching when it is already playing', async () => {
    setStatus({ playing: true });
    await render(<RecordingRow recording={makeRecording()} />);

    await fireEvent.press(screen.getByLabelText('Pause recording'));

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(getUrlMock).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('tells the user the link expired rather than failing silently', async () => {
    getUrlMock.mockRejectedValue(new Error('410 Gone'));
    await render(<RecordingRow recording={makeRecording()} />);

    await fireEvent.press(screen.getByLabelText('Play recording'));

    expect(await screen.findByText('This recording link has expired.')).toBeTruthy();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('hides the scrubber until the clip is loaded and has a duration', async () => {
    const notLoaded = await render(<RecordingRow recording={makeRecording()} />);
    expect(screen.queryByText(/0:00 \//)).toBeNull();
    await notLoaded.unmount();

    // Loaded but zero-length — the guard that keeps `currentTime / duration` off NaN.
    setStatus({ isLoaded: true, duration: 0 });
    const zeroLength = await render(<RecordingRow recording={makeRecording()} />);
    expect(screen.queryByText(/0:00 \//)).toBeNull();
    await zeroLength.unmount();

    setStatus({ isLoaded: true, duration: 125, currentTime: 65 });
    await render(<RecordingRow recording={makeRecording()} />);

    expect(screen.getByText('1:05 / 2:05')).toBeTruthy();
  });

  it('swaps the button label so assistive tech announces the action, not the state', async () => {
    const paused = await render(<RecordingRow recording={makeRecording()} />);
    expect(screen.getByLabelText('Play recording')).toBeTruthy();
    expect(screen.queryByLabelText('Pause recording')).toBeNull();
    await paused.unmount();

    setStatus({ playing: true });
    await render(<RecordingRow recording={makeRecording()} />);

    expect(screen.getByLabelText('Pause recording')).toBeTruthy();
  });
});
