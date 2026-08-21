import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getRecordingDownloadUrl } from '@/api/recordings';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/theme/tokens';
import type { Recording } from '@/types/recording';

export function RecordingRow({ recording }: { recording: Recording }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState<string>();

  async function togglePlay() {
    setError(undefined);
    if (status.playing) {
      player.pause();
      return;
    }
    try {
      // Requested fresh per play — the URL is temporary and can expire between plays.
      const { url } = await getRecordingDownloadUrl(recording.id);
      player.replace(url);
      player.play();
    } catch {
      setError('This recording link has expired.');
    }
  }

  return (
    <View style={styles.row}>
      <Button variant="icon" onPress={togglePlay}>
        {status.playing ? (
          <Pause size={18} strokeWidth={2.75} />
        ) : (
          <Play size={18} strokeWidth={2.75} />
        )}
      </Button>
      <View style={styles.info}>
        <ThemedText type="body">{recording.originalFileName}</ThemedText>
        {error && (
          <ThemedText type="caption" color="textMuted">
            {error}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[2] },
  info: { flex: 1 },
});
