import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTask } from '@/api/tasks.queries';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge } from '@/components/ui/badge';
import { ErrorPanel } from '@/components/ui/error-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { MaxContentWidth, Spacing } from '@/theme/tokens';

export function TaskDetail({ taskId }: { taskId: string }) {
  const { data: task, isPending, isError, refetch } = useTask(taskId);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {isPending ? (
            <Skeleton height={160} />
          ) : isError ? (
            <ErrorPanel title="Couldn't load this task" onRetry={refetch} />
          ) : (
            <>
              <ThemedText type="h3">{task.title}</ThemedText>
              <ThemedView style={styles.badges}>
                {task.category && <Badge label={task.category} variant="category" />}
                {task.difficulty && <Badge label={task.difficulty} variant="difficulty" />}
              </ThemedView>
              {task.description && <ThemedText type="body">{task.description}</ThemedText>}
              {task.referenceLink && (
                <ExternalLink href={task.referenceLink as `${string}:${string}`}>
                  <ThemedText type="body" color="accent">
                    Open reference
                  </ThemedText>
                </ExternalLink>
              )}
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
  scroll: { padding: Spacing[4], gap: Spacing[3] },
  badges: { flexDirection: 'row', gap: Spacing[2], backgroundColor: 'transparent' },
});
