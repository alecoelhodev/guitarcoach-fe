import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeError } from '@/api/errors';
import { useRecordings } from '@/api/recordings.queries';
import { useSession } from '@/api/sessions.queries';
import { useTask } from '@/api/tasks.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ErrorPanel } from '@/components/ui/error-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { RecordingRow } from '@/features/history/recording-row';
import { formatMinutes, sumSessionMinutes } from '@/lib/duration';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/theme/tokens';
import type { PracticeSessionTask } from '@/types/session';

/**
 * Canvas 09's read-only tick. A finished session cannot be edited, so this is the
 * static counterpart to `ChecklistRow` rather than an interactive checkbox.
 */
function Tick({ completed }: { completed: boolean }) {
  return <View style={[styles.tick, completed && styles.tickOn]} />;
}

function SessionTaskRow({ task }: { task: PracticeSessionTask }) {
  const { data } = useTask(task.taskId);

  return (
    <View style={styles.taskRow}>
      <Tick completed={task.completed} />
      <View style={styles.taskInfo}>
        <ThemedText
          type="label"
          style={task.completed ? undefined : styles.incompleteTitle}
          numberOfLines={2}
        >
          {data?.title ?? task.taskId}
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
  const sessionQuery = useSession(sessionId);
  const recordingsQuery = useRecordings(sessionId);

  if (sessionQuery.isPending) {
    return (
      <Card>
        <Skeleton width="70%" />
        <Skeleton width="45%" />
      </Card>
    );
  }
  if (sessionQuery.isError) {
    const { title, message } = describeError(sessionQuery.error, "Couldn't load this session");
    return <ErrorPanel title={title} message={message} onRetry={() => sessionQuery.refetch()} />;
  }

  const session = sessionQuery.data;
  const tasks = session.sessionTasks ?? [];
  const minutes = sumSessionMinutes(session);
  const recordings = recordingsQuery.data ?? [];

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

          {session.notes && (
            <Card quiet>
              <ThemedText type="body" color="textMuted">
                {session.notes}
              </ThemedText>
            </Card>
          )}

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

          {recordings.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <ThemedText type="overline" color="textMuted">
                  Recordings
                </ThemedText>
                <ThemedText type="body" color="textMuted">
                  {recordings.length} {recordings.length === 1 ? 'file' : 'files'}
                </ThemedText>
              </View>
              {recordings.map((recording) => (
                <RecordingRow key={recording.id} recording={recording} />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
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
