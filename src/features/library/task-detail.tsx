import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTask } from '@/api/tasks.queries';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/ui/query-state';
import { Colors, MaxContentWidth, Spacing } from '@/theme/tokens';

export function TaskDetail({ taskId }: { taskId: string }) {
  const query = useTask(taskId);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <QueryState query={query} errorTitle="Couldn't load this task">
            {(task) => (
              <>
                {/* Canvas 04 leads with the badges, then the title. */}
                <View style={styles.badges}>
                  {task.category && <Badge label={task.category} variant="category" />}
                  {task.difficulty && <Badge label={task.difficulty} variant="difficulty" />}
                </View>

                <ThemedText type="h3">{task.title}</ThemedText>

                {task.description && (
                  <Card>
                    <ThemedText type="body" color="textMuted">
                      {task.description}
                    </ThemedText>
                  </Card>
                )}

                {task.referenceLink && (
                  <ExternalLink href={task.referenceLink as `${string}:${string}`}>
                    <Card>
                      <View style={styles.referenceRow}>
                        <ThemedText type="label">Reference link</ThemedText>
                        <ThemedText type="body" style={styles.link}>
                          ↗
                        </ThemedText>
                      </View>
                      <ThemedText type="body" color="textMuted">
                        Opens outside the app
                      </ThemedText>
                    </Card>
                  </ExternalLink>
                )}

                <ThemedText type="body" color="textMuted" style={styles.note}>
                  Tasks are shared and read-only.
                </ThemedText>
              </>
            )}
          </QueryState>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  scroll: { padding: Spacing[4], gap: Spacing[3] },
  badges: { flexDirection: 'row', gap: Spacing[2] },
  referenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: Colors.accentRamp[700] },
  note: { textAlign: 'center' },
});
