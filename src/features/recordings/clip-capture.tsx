import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { MAX_CLIP_SECONDS } from '@/features/recordings/clip-limit';
import {
  type Clip,
  pickRecordingFile,
  RecordingRejected,
} from '@/features/recordings/pick-recording';
import { useClipRecorder } from '@/features/recordings/use-clip-recorder';
import { formatClock } from '@/lib/duration';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const FORMATS = `MP3, WAV, M4A, OGG or WebM · up to ${MAX_CLIP_SECONDS} s`;

type PickProblem = { title: string; detail?: string };

/**
 * Record a clip on the device or choose an existing file. Hands the clip to `onClip` and leaves
 * what happens next — upload now, or hold until Finish — to the caller.
 */
export function ClipCapture({
  onClip,
  disabled = false,
}: {
  onClip: (clip: Clip) => void;
  disabled?: boolean;
}) {
  const recorder = useClipRecorder(onClip);
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<PickProblem>();

  async function chooseFile() {
    if (picking) return;
    setProblem(undefined);
    setPicking(true);
    try {
      const clip = await pickRecordingFile();
      if (clip) onClip(clip);
    } catch (error) {
      setProblem(
        error instanceof RecordingRejected
          ? { title: "That file can't be attached", detail: error.message }
          : { title: "Couldn't open the file picker" },
      );
    } finally {
      setPicking(false);
    }
  }

  function record() {
    setProblem(undefined);
    void recorder.start();
  }

  if (recorder.status === 'recording') {
    return (
      <View style={styles.container}>
        <View
          style={styles.recording}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Recording, ${recorder.seconds} of ${MAX_CLIP_SECONDS} seconds`}
        >
          <View style={styles.dot} />
          <ThemedText type="body">
            {`${formatClock(recorder.seconds)} / ${formatClock(MAX_CLIP_SECONDS)}`}
          </ThemedText>
        </View>
        <Button
          variant="secondary"
          accessibilityLabel="Stop recording"
          onPress={() => void recorder.stop()}
        >
          Stop
        </Button>
      </View>
    );
  }

  const recorderProblem =
    recorder.status === 'denied'
      ? 'Microphone access is off — enable it in Settings.'
      : recorder.status === 'failed'
        ? "Recording didn't work. Try again."
        : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Button variant="secondary" onPress={record} disabled={disabled || picking}>
          Record
        </Button>
        <Button
          variant="secondary"
          onPress={() => void chooseFile()}
          disabled={disabled || picking}
        >
          Choose file
        </Button>
      </View>
      {(problem || recorderProblem) && (
        <View accessibilityRole="alert" style={styles.container}>
          <ThemedText type="label" style={styles.error}>
            {problem?.title ?? recorderProblem}
          </ThemedText>
          {problem?.detail && (
            <ThemedText type="body" color="textMuted">
              {problem.detail}
            </ThemedText>
          )}
        </View>
      )}
      <ThemedText type="caption" color="textMuted">
        {FORMATS}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing[2] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  recording: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  dot: { width: 10, height: 10, borderRadius: Radius.pill, backgroundColor: Colors.danger },
  error: { color: Colors.dangerRamp[700] },
});
