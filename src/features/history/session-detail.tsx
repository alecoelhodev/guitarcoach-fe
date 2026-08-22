import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRecordings } from '@/api/recordings.queries';
import { useSession } from '@/api/sessions.queries';
import { useTask } from '@/api/tasks.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ErrorPanel } from '@/components/ui/error-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { RecordingRow } from '@/features/history/recording-row';
import { formatMinutes } from '@/lib/duration';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import type { PracticeSessionTask } from '@/types/session';

function SessionTaskRow({ task }: { task: PracticeSessionTask }) {
  const { data } = useTask(task.taskId);

  return (
    <Card style={styles.taskRow}>
      <ThemedText type="body">{task.completed ? '✓' : '○'}</ThemedText>
      <ThemedText type="body" style={{ flex: 1 }}>
        {data?.title ?? task.taskId}
      </ThemedText>
      {task.durationMinutes != null && (
        <ThemedText type="caption" color="textMuted">
          {formatMinutes(task.durationMinutes)}
        </ThemedText>
      )}
    </Card>
  );
}

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const sessionQuery = useSession(sessionId);
  const recordingsQuery = useRecordings(sessionId);

  if (sessionQuery.isPending) return <Skeleton height={200} />;
  if (sessionQuery.isError) {
    return <ErrorPanel title="Couldn't load this session" onRetry={() => sessionQuery.refetch()} />;
  }

  const session = sessionQuery.data;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="h3">{session.title ?? 'Practice session'}</ThemedText>
          <ThemedText type="caption" color="textMuted">
            {new Date(session.createdAt).toLocaleString()}
          </ThemedText>

          <View style={styles.taskList}>
            {(session.sessionTasks ?? []).map((task) => (
              <SessionTaskRow key={task.taskId} task={task} />
            ))}
          </View>

          {recordingsQuery.data && recordingsQuery.data.length > 0 && (
            <View>
              <ThemedText type="overline" color="textMuted">
                Recordings
              </ThemedText>
              {recordingsQuery.data.map((recording) => (
                <RecordingRow key={recording.id} recording={recording} />
              ))}
            </View>
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
  taskList: { gap: Spacing[2] },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
});
