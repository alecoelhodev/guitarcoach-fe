import * as DocumentPicker from 'expo-document-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useUploadRecording } from '@/api/recordings.queries';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { validateRecordingFile } from '@/lib/file-validation';
import { succeeded } from '@/lib/haptics';
import { useToastStore } from '@/stores/toast-store';
import { Colors, Spacing } from '@/theme/tokens';

type UploadFile = Parameters<ReturnType<typeof useUploadRecording>['mutateAsync']>[0];
type Phase = 'idle' | 'picking' | 'uploading' | 'invalid' | 'failed' | 'picker-failed';
const FORMATS = 'MP3, WAV, M4A, OGG or WebM · up to 50 MB';

export function RecordingUpload({ sessionId }: { sessionId: string }) {
  const upload = useUploadRecording(sessionId);
  const [file, setFile] = useState<UploadFile>();
  const [phase, setPhase] = useState<Phase>('idle');
  // `validateRecordingFile` says *why* it refused; the screen used to throw that away and
  // show one line for both "too big" and "wrong format", neither of which tells the user
  // which file to pick next.
  const [rejection, setRejection] = useState<string>();
  const busy = useRef(false);
  const showToast = useToastStore((state) => state.show);

  async function sendFile(selected: UploadFile) {
    setRejection(undefined);
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

  async function chooseFile() {
    if (busy.current) return;
    busy.current = true;
    setPhase('picking');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: false,
        copyToCacheDirectory: true,
        // Web-only, and it defaults to `true`: with base64 on, `asset.uri` is the whole file
        // re-encoded as a data URL — up to 50 MB of string we no longer read, because the
        // browser path uploads `asset.file` instead.
        base64: false,
      });
      if (result.canceled) {
        setPhase('idle');
        busy.current = false;
        return;
      }
      const asset = result.assets[0];
      const check = asset ? validateRecordingFile(asset) : undefined;
      if (!asset || !check?.valid || !asset.mimeType) {
        setFile(undefined);
        setRejection(check && !check.valid ? check.reason : undefined);
        setPhase('invalid');
        busy.current = false;
        return;
      }
      const selected = {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        // Web only, and the only form a browser's FormData can send as a file. Dropping it
        // here is what made every web upload fail as "That file can't be uploaded".
        file: asset.file,
      };
      setFile(selected);
      await sendFile(selected);
    } catch {
      setPhase('picker-failed');
      busy.current = false;
    }
  }

  function retry() {
    if (!file || busy.current) return;
    busy.current = true;
    void sendFile(file);
  }

  const pending = phase === 'uploading' || phase === 'picking';
  return (
    <View style={styles.container}>
      <Button
        variant="secondary"
        onPress={() => {
          void chooseFile();
        }}
        disabled={pending}
      >
        {phase === 'invalid' || phase === 'picker-failed' ? 'Choose another' : 'Upload recording'}
      </Button>
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
      {(phase === 'invalid' || phase === 'failed' || phase === 'picker-failed') && (
        <View accessibilityRole="alert" style={styles.container}>
          <ThemedText type="label" style={styles.error}>
            {phase === 'invalid'
              ? "That file can't be uploaded"
              : phase === 'failed'
                ? "Upload didn't finish"
                : "Couldn't open the file picker"}
          </ThemedText>
          {phase === 'invalid' && rejection && (
            <ThemedText type="body" color="textMuted">
              {rejection}
            </ThemedText>
          )}
          {phase === 'failed' && (
            <>
              <ThemedText type="body" color="textMuted">
                {file?.name}
              </ThemedText>
              <Button variant="secondary" onPress={retry}>
                Retry upload
              </Button>
            </>
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
  progress: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], flexWrap: 'wrap' },
  error: { color: Colors.dangerRamp[700] },
});
