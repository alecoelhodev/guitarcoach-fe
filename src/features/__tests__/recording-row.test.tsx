jest.mock('@/api/recordings.queries', () => ({ useDeleteRecording: jest.fn() }));

jest.mock('@/api/recordings', () => ({ getRecordingDownloadUrl: jest.fn() }));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { getRecordingDownloadUrl } from '@/api/recordings';
import { useDeleteRecording } from '@/api/recordings.queries';
import { RecordingRow } from '@/features/history/recording-row';
import { makeRecording } from '@/test/fixtures';
import { withGluestack } from '@/test/gluestack';
import { mutationStub } from '@/test/query-hooks';

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

const player = {
  play: jest.fn(),
  pause: jest.fn(),
  replace: jest.fn(),
  seekTo: jest.fn().mockResolvedValue(undefined),
};

type Status = {
  playing?: boolean;
  isLoaded?: boolean;
  currentTime?: number;
  duration?: number;
  error?: string | null;
  didJustFinish?: boolean;
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

let deletion: ReturnType<typeof mutationStub>;

beforeEach(() => {
  jest.clearAllMocks();
  deletion = mutationStub();
  (useDeleteRecording as jest.Mock).mockReturnValue(deletion);
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

    expect(await screen.findByText('This playback link has expired.')).toBeTruthy();
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

describe('playback recovery', () => {
  it('does not request any URL until play is pressed', async () => {
    await render(<RecordingRow recording={makeRecording()} />);
    expect(getUrlMock).not.toHaveBeenCalled();
  });

  it('renews a failed URL and resumes from the previous position', async () => {
    setStatus({ currentTime: 72, duration: 180, isLoaded: true, error: 'HTTP 403' });
    const view = await render(<RecordingRow recording={makeRecording()} />);
    expect(screen.getByText('This playback link has expired.')).toBeTruthy();
    getUrlMock.mockResolvedValueOnce({ url: 'https://cdn.example.com/fresh' });
    await fireEvent.press(screen.getByText('Get a new link'));
    await waitFor(() => expect(player.play).toHaveBeenCalledTimes(1));
    expect(player.replace).toHaveBeenCalledWith('https://cdn.example.com/fresh');
    expect(player.seekTo).toHaveBeenCalledWith(72);
    setStatus({ currentTime: 72, duration: 180, isLoaded: true, playing: true, error: null });
    await view.rerender(<RecordingRow recording={makeRecording()} />);
    expect(screen.queryByText('Get a new link')).toBeNull();
  });

  it('recovers a download request failure without a seek on first play', async () => {
    getUrlMock.mockRejectedValueOnce(new Error('offline'));
    await render(<RecordingRow recording={makeRecording()} />);
    await fireEvent.press(screen.getByLabelText('Play recording'));
    await fireEvent.press(await screen.findByText('Get a new link'));
    await waitFor(() => expect(player.play).toHaveBeenCalledTimes(1));
    expect(getUrlMock).toHaveBeenCalledTimes(2);
    expect(player.seekTo).not.toHaveBeenCalled();
    expect(screen.queryByText('This playback link has expired.')).toBeNull();
  });

  it('shows asynchronous playback failures after a successful URL request', async () => {
    const view = await render(<RecordingRow recording={makeRecording()} />);
    await fireEvent.press(screen.getByLabelText('Play recording'));
    setStatus({ error: 'Media load failed' });
    await view.rerender(<RecordingRow recording={makeRecording()} />);
    expect(screen.getByText('Get a new link')).toBeTruthy();
  });

  it('handles a failed source replacement', async () => {
    player.replace.mockImplementationOnce(() => {
      throw new Error('invalid source');
    });
    await render(<RecordingRow recording={makeRecording()} />);
    await fireEvent.press(screen.getByLabelText('Play recording'));
    expect(await screen.findByText('Get a new link')).toBeTruthy();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('restarts a completed recording at the beginning', async () => {
    setStatus({ currentTime: 180, duration: 180, didJustFinish: true });
    await render(<RecordingRow recording={makeRecording()} />);
    await fireEvent.press(screen.getByLabelText('Play recording'));
    await waitFor(() => expect(player.play).toHaveBeenCalledTimes(1));
    expect(player.seekTo).not.toHaveBeenCalled();
  });

  it('prevents duplicate requests and ignores a URL received after unmount', async () => {
    let resolve!: (result: { url: string }) => void;
    getUrlMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = await render(<RecordingRow recording={makeRecording()} />);
    await fireEvent.press(screen.getByLabelText('Play recording'));
    expect(screen.getByText('Getting playback link…')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Play recording'));
    expect(getUrlMock).toHaveBeenCalledTimes(1);
    await view.unmount();
    await act(async () => {
      resolve({ url: 'https://cdn.example.com/late' });
    });
    expect(player.replace).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
  });
});

describe('recording deletion', () => {
  const recording = makeRecording({
    id: 'rec-delete',
    practiceSessionId: 'session-42',
    originalFileName: 'take.m4a',
  });
  const renderRow = () => render(withGluestack(<RecordingRow recording={recording} />));

  it('requires confirmation, stops playback and removes the row on success', async () => {
    setStatus({ playing: true });
    await renderRow();
    await fireEvent.press(screen.getByLabelText('Delete take.m4a'));
    expect(screen.getByText("Delete 'take.m4a'?")).toBeTruthy();
    expect(screen.getByText('The audio is removed for good.')).toBeTruthy();
    expect(deletion.mutateAsync).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: /^Delete$/ }));
    expect(useDeleteRecording).toHaveBeenCalledWith('session-42');
    expect(deletion.mutateAsync).toHaveBeenCalledWith('rec-delete');
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('take.m4a')).toBeNull();
  });

  it('keeps the file and playback unchanged when confirmation is cancelled', async () => {
    await renderRow();
    await fireEvent.press(screen.getByLabelText('Delete take.m4a'));
    expect(screen.getByText('The audio is removed for good.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(screen.queryByText('The audio is removed for good.')).toBeNull();
    expect(screen.getByText('take.m4a')).toBeTruthy();
    expect(deletion.mutateAsync).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
  });

  it('retains the row after failure and requires confirmation again to retry', async () => {
    deletion.mutateAsync.mockRejectedValueOnce(new Error('offline'));
    await renderRow();
    await fireEvent.press(screen.getByLabelText('Delete take.m4a'));
    await fireEvent.press(screen.getByRole('button', { name: /^Delete$/ }));
    expect(screen.getByText("Couldn't delete recording")).toBeTruthy();
    expect(screen.getByText('take.m4a')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Delete take.m4a'));
    await fireEvent.press(screen.getByRole('button', { name: /^Delete$/ }));
    expect(deletion.mutateAsync).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('take.m4a')).toBeNull();
  });

  it('disables actions while deleting and prevents a late URL from starting playback', async () => {
    let resolveUrl!: (value: { url: string }) => void;
    let finishDelete!: () => void;
    getUrlMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUrl = resolve;
        }),
    );
    deletion.mutateAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishDelete = resolve;
        }),
    );
    await renderRow();
    await fireEvent.press(screen.getByLabelText('Play recording'));
    await fireEvent.press(screen.getByLabelText('Delete take.m4a'));
    await fireEvent.press(screen.getByRole('button', { name: /^Delete$/ }));
    expect(screen.getByText('Deleting…')).toBeTruthy();
    expect(screen.getByLabelText('Delete take.m4a')).toBeDisabled();
    expect(screen.getByLabelText('Play recording')).toBeDisabled();
    await act(async () => {
      resolveUrl({ url: 'https://cdn.example.com/late' });
    });
    expect(player.play).not.toHaveBeenCalled();
    await act(async () => {
      finishDelete();
    });
    expect(screen.queryByText('take.m4a')).toBeNull();
  });
});
