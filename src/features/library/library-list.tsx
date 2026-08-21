import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listTasks } from '@/api/tasks';
import { queryKeys } from '@/api/query-keys';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorPanel } from '@/components/ui/error-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskCard } from '@/features/library/task-card';
import { MaxContentWidth, Spacing, TabBarInset } from '@/theme/tokens';

export function LibraryList() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.tasks(),
    queryFn: () => listTasks(),
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3" style={styles.title}>
          Library
        </ThemedText>

        {isPending ? (
          <Skeleton height={80} />
        ) : isError ? (
          <ErrorPanel title="Couldn't load the library" onRetry={refetch} />
        ) : data.data.length === 0 ? (
          <EmptyState title="No tasks yet" />
        ) : (
          <FlatList
            data={data.data}
            keyExtractor={(task) => task.id}
            renderItem={({ item }) => <TaskCard task={item} />}
            contentContainerStyle={styles.list}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  title: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[2] },
  list: { padding: Spacing[4], paddingBottom: TabBarInset + Spacing[4], gap: Spacing[3] },
});
