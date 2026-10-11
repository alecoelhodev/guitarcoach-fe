import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ApiError, type UploadFile } from '@/api/client';
import { useUploadRecording } from '@/api/recordings.queries';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ClipCapture } from '@/features/recordings/clip-capture';
import { succeeded } from '@/lib/haptics';
import { useToastStore } from '@/stores/toast-store';
import { Colors, Spacing } from '@/theme/tokens';

type Phase = 'idle' | 'uploading' | 'invalid' | 'failed';

/** A saved session's recordings: record or choose a clip, and it uploads straight away. */
export function RecordingUpload({ sessionId }: { sessionId: string }) {
  const upload = useUploadRecording(sessionId);
  const [file, setFile] = useState<UploadFile>();
  const [phase, setPhase] = useState<Phase>('idle');
  const busy = useRef(false);
  const showToast = useToastStore((state) => state.show);

  async function sendFile(selected: UploadFile) {
    if (busy.current) return;
    busy.current = true;
    setFile(selected);
    setPhase('uploading');
    try {
      await upload.mutateAsync(selected);
      setFile(undefined);
      setPhase('idle');
      succeeded();
      showToast('Recording added', 'success');
    } catch (error) {
      setPhase(
        error instanceof ApiError && [400, 413].includes(error.status) ? 'invalid' : 'failed',
      );
    } finally {
      busy.current = false;
    }
  }

  return (
    <View style={styles.container}>
      <ClipCapture onClip={(clip) => void sendFile(clip.file)} disabled={phase === 'uploading'} />
      {phase === 'uploading' && (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Uploading recording"
          style={styles.progress}
        >
          <ActivityIndicator color={Colors.accentRamp[700]} />
          <ThemedText type="body">Uploading {file?.name}…</ThemedText>
        </View>
      )}
      {(phase === 'invalid' || phase === 'failed') && (
        <View accessibilityRole="alert" style={styles.container}>
          <ThemedText type="label" style={styles.error}>
            {phase === 'invalid' ? "That file can't be uploaded" : "Upload didn't finish"}
          </ThemedText>
          {phase === 'failed' && file && (
            <>
              <ThemedText type="body" color="textMuted">
                {file.name}
              </ThemedText>
              <Button variant="secondary" onPress={() => void sendFile(file)}>
                Retry upload
              </Button>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing[2] },
  progress: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], flexWrap: 'wrap' },
  error: { color: Colors.dangerRamp[700] },
});
