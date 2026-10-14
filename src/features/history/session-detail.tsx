import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeError } from '@/api/errors';
import { useRecordings } from '@/api/recordings.queries';
import { useSession } from '@/api/sessions.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorPanel } from '@/components/ui/error-panel';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { RecordingRow } from '@/features/history/recording-row';
import { RecordingUpload } from '@/features/history/recording-upload';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useResumeSession } from '@/features/session/use-resume-session';
import { formatMinutes, sumSessionMinutes } from '@/lib/duration';
import { useSessionStore } from '@/stores/session-store';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/theme/tokens';
import type { PracticeSessionTask } from '@/types/session';

/**
 * Canvas 09's read-only tick, the static counterpart to `ChecklistRow`. Ticking happens after
 * Resume, on the Active Session screen.
 */
function Tick({ completed }: { completed: boolean }) {
  return <View style={[styles.tick, completed && styles.tickOn]} />;
}

function SessionTaskRow({ task }: { task: PracticeSessionTask }) {
  return (
    <View style={styles.taskRow}>
      <Tick completed={task.completed} />
      <View style={styles.taskInfo}>
        <ThemedText
          type="label"
          style={task.completed ? undefined : styles.incompleteTitle}
          numberOfLines={2}
        >
          {task.task.title}
        </ThemedText>
        {!task.completed && (
          <ThemedText type="body" color="textMuted">
            Not completed
          </ThemedText>
        )}
      </View>
      {/* Per-task minutes are optional; canvas shows an em dash when absent. */}
      <ThemedText type="body" color="textMuted">
        {task.durationMinutes != null ? formatMinutes(task.durationMinutes) : '—'}
      </ThemedText>
    </View>
  );
}

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const sessionQuery = useSession(sessionId);
  const recordingsQuery = useRecordings(sessionId);
  const resumeSession = useResumeSession();
  const userId = useSessionStore((state) => state.user?.id);
  const activeOwner = useActiveSessionStore((state) => state.userId);
  const activeSessionId = useActiveSessionStore((state) => state.sessionId);
  const activeTaskCount = useActiveSessionStore((state) => state.tasks.length);
  const [confirmReplace, setConfirmReplace] = useState(false);

  if (sessionQuery.isPending) return <SkeletonCard />;
  if (sessionQuery.isError) {
    const { title, message } = describeError(sessionQuery.error, "Couldn't load this session");
    return <ErrorPanel title={title} message={message} onRetry={() => sessionQuery.refetch()} />;
  }

  const session = sessionQuery.data;
  const tasks = session.sessionTasks ?? [];
  const minutes = sumSessionMinutes(session);
  const recordings = recordingsQuery.data ?? [];

  function handleResume() {
    // Already resumed and still open on this device: carry on rather than restart it.
    if (activeSessionId === sessionId) {
      router.push({ pathname: '/session/active', params: { from: 'history' } });
      return;
    }
    // Resuming replaces the local session, so one with unsaved practice is asked about first.
    if (activeTaskCount > 0 && activeOwner === userId) setConfirmReplace(true);
    else resumeSession(session);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View>
            <ThemedText type="h3">{session.title ?? 'Practice session'}</ThemedText>
            <ThemedText type="body" color="textMuted">
              {new Date(session.createdAt).toLocaleString()}
            </ThemedText>
          </View>

          <Button variant="secondary" block onPress={handleResume}>
            Resume
          </Button>

          {session.notes ? (
            <Card quiet>
              <ThemedText type="body" color="textMuted">
                {session.notes}
              </ThemedText>
            </Card>
          ) : null}

          <View style={styles.sectionHeader}>
            <ThemedText type="overline" color="textMuted">
              Practiced
            </ThemedText>
            {minutes > 0 && <ThemedText type="label">{formatMinutes(minutes)}</ThemedText>}
          </View>

          {tasks.length > 0 && (
            <Card>
              {tasks.map((task) => (
                <SessionTaskRow key={task.taskId} task={task} />
              ))}
            </Card>
          )}

          <View style={styles.sectionHeader}>
            <ThemedText type="overline" color="textMuted">
              Recordings
            </ThemedText>
            {recordingsQuery.data && (
              <ThemedText type="body" color="textMuted">
                {recordings.length} {recordings.length === 1 ? 'file' : 'files'}
              </ThemedText>
            )}
          </View>
          <RecordingUpload key={sessionId} sessionId={sessionId} />
          <QueryState
            query={recordingsQuery}
            errorTitle="Couldn't load recordings"
            isEmpty={recordings.length === 0}
            empty={
              <EmptyState title="No recordings for this session. Upload one to hear it back later." />
            }
          >
            {(items) =>
              items.map((recording) => <RecordingRow key={recording.id} recording={recording} />)
            }
          </QueryState>
        </ScrollView>
      </SafeAreaView>
      <ConfirmDialog
        visible={confirmReplace}
        title="Replace the session in progress?"
        message="Its unsaved practice is discarded."
        confirmLabel="Replace"
        destructive
        onConfirm={() => {
          setConfirmReplace(false);
          resumeSession(session);
        }}
        onCancel={() => setConfirmReplace(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  scroll: { padding: Spacing[4], gap: Spacing[4] },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  taskInfo: { flex: 1 },
  incompleteTitle: { color: Colors.neutral[700] },
  tick: {
    width: 20,
    height: 20,
    borderRadius: Radius.xs,
    borderWidth: 1.5,
    borderColor: Colors.neutral[400],
  },
  tickOn: {
    backgroundColor: Colors.accent2,
    borderColor: Colors.accent2,
  },
});
