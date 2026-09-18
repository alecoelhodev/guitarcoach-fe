import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { describeError, type ErrorDescription } from '@/api/errors';
import { getRecordingDownloadUrl } from '@/api/recordings';
import { useDeleteRecording } from '@/api/recordings.queries';
import { ThemedText } from '@/components/themed-text';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorPanel } from '@/components/ui/error-panel';
import { Progress, ProgressFilledTrack } from '@/components/ui/progress';
import { formatClock } from '@/lib/duration';
import { Colors, Spacing } from '@/theme/tokens';
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
  const deletion = useDeleteRecording(recording.practiceSessionId);
  // The description, not a flag: a 500 from the signed-URL endpoint and a player that cannot
  // decode an already-issued URL are different failures and used to read identically.
  const [error, setError] = useState<ErrorDescription | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const requestId = useRef(0);
  const fetching = useRef(false);
  const removing = useRef(false);
  const resumeAt = useRef(0);

  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );
  useEffect(() => {
    if (status.didJustFinish) resumeAt.current = 0;
    else if (status.currentTime > 0) resumeAt.current = status.currentTime;
  }, [status.currentTime, status.didJustFinish]);

  async function playFresh() {
    if (fetching.current || removing.current) return;
    fetching.current = true;
    const attempt = ++requestId.current;
    setError(null);
    setLoading(true);
    try {
      // URLs are requested only on intent to play. Preserve the position when refreshing.
      const position = resumeAt.current;
      const { url } = await getRecordingDownloadUrl(recording.id);
      if (attempt !== requestId.current) return;
      player.replace(url);
      if (position > 0) await player.seekTo(position);
      if (attempt !== requestId.current) return;
      player.play();
    } catch (cause) {
      // The service failing to issue a link is not an expired link — no URL was involved.
      if (attempt === requestId.current) {
        setError(describeError(cause, "Couldn't get a playback link"));
      }
    } finally {
      if (attempt === requestId.current) {
        fetching.current = false;
        setLoading(false);
      }
    }
  }

  function togglePlay() {
    if (status.playing) player.pause();
    else void playFresh();
  }

  async function deleteFile() {
    if (removing.current) return;
    removing.current = true;
    // A late signed-URL response must never start playing a deleted recording.
    requestId.current += 1;
    fetching.current = false;
    setLoading(false);
    setConfirming(false);
    setDeleting(true);
    setDeleteError(false);
    try {
      player.pause();
      await deletion.mutateAsync(recording.id);
      setDeleted(true);
    } catch {
      setDeleteError(true);
    } finally {
      removing.current = false;
      setDeleting(false);
    }
  }

  if (deleted) return null;
  // A player error is the one case where "expired" is a fair guess: the link was issued, then
  // the fetch behind it failed. Anything the transport reported names itself instead.
  const playbackError =
    error ??
    (status.error ? { title: 'This playback link has expired.', message: undefined } : null);
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
          disabled={loading || deleting || confirming}
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

      {loading && (
        <ThemedText type="caption" color="textMuted">
          Getting playback link…
        </ThemedText>
      )}
      {playbackError && (
        <View accessibilityRole="alert" style={styles.error}>
          <ThemedText type="caption" style={{ color: Colors.dangerRamp[700] }}>
            {playbackError.title}
          </ThemedText>
          {playbackError.message && (
            <ThemedText type="caption" color="textMuted">
              {playbackError.message}
            </ThemedText>
          )}
          <Button
            variant="secondary"
            disabled={loading || deleting || confirming}
            onPress={() => {
              void playFresh();
            }}
          >
            Get a new link
          </Button>
        </View>
      )}
      {deleteError && (
        <ErrorPanel title="Couldn't delete recording" message="Try deleting it again." />
      )}
      <Button
        variant="tertiary"
        disabled={deleting}
        accessibilityLabel={`Delete ${recording.originalFileName}`}
        onPress={() => setConfirming(true)}
      >
        <ButtonText className="text-danger-700">{deleting ? 'Deleting…' : 'Delete'}</ButtonText>
      </Button>
      <ConfirmDialog
        visible={confirming}
        title={`Delete '${recording.originalFileName}'?`}
        message="The audio is removed for good."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          void deleteFile();
        }}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  name: { flex: 1 },
  scrubber: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  track: { flex: 1 },
  error: { gap: Spacing[2] },
});
