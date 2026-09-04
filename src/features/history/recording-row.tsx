import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getRecordingDownloadUrl } from '@/api/recordings';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress, ProgressFilledTrack } from '@/components/ui/progress';
import { formatClock } from '@/lib/duration';
import { Spacing } from '@/theme/tokens';
import type { Recording } from '@/types/recording';

/** Canvas 09 labels the file by format: "M4A · 4.2 MB · today 8:44 PM". */
function describeFile(recording: Recording) {
  const format = recording.contentType.split('/').pop()?.replace(/^x-/, '').toUpperCase();
  const megabytes = (recording.sizeBytes / (1024 * 1024)).toFixed(1);
  const time = new Date(recording.createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return [format, `${megabytes} MB`, time].filter(Boolean).join(' · ');
}

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

  const progress = status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0;

  return (
    <Card>
      <View style={styles.row}>
        <ThemedText type="label" style={styles.name} numberOfLines={1}>
          {recording.originalFileName}
        </ThemedText>
        <Button
          variant="tertiary"
          className="h-[44px] w-[44px] rounded-pill px-0"
          accessibilityLabel={status.playing ? 'Pause recording' : 'Play recording'}
          onPress={togglePlay}
        >
          {status.playing ? (
            <Pause size={18} strokeWidth={2.75} />
          ) : (
            <Play size={18} strokeWidth={2.75} />
          )}
        </Button>
      </View>

      <ThemedText type="body" color="textMuted">
        {describeFile(recording)}
      </ThemedText>

      {status.isLoaded && status.duration > 0 && (
        <View style={styles.scrubber}>
          <Progress value={progress} style={styles.track}>
            <ProgressFilledTrack />
          </Progress>
          <ThemedText type="body" color="textMuted">
            {formatClock(status.currentTime)} / {formatClock(status.duration)}
          </ThemedText>
        </View>
      )}

      {error && (
        <ThemedText type="caption" color="textMuted">
          {error}
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  name: { flex: 1 },
  scrubber: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  track: { flex: 1 },
});
