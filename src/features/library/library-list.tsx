import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTasks } from '@/api/tasks.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { TaskCard } from '@/features/library/task-card';
import { TabBarInset } from '@/theme/platform';
import { MaxContentWidth, Spacing } from '@/theme/tokens';

export function LibraryList() {
  const query = useTasks();
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const tasks = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3" style={styles.title}>
          Task library
        </ThemedText>

        <QueryState
          query={query}
          errorTitle="Couldn't load the library"
          isEmpty={tasks.length === 0}
          empty={<EmptyState title="No tasks yet" />}
        >
          {() => (
            <FlatList
              ListHeaderComponent={
                <ThemedText type="body" color="textMuted" style={styles.count}>
                  {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                </ThemedText>
              }
              data={tasks}
              keyExtractor={(task) => task.id}
              renderItem={({ item }) => <TaskCard task={item} />}
              contentContainerStyle={styles.list}
              ListFooterComponent={
                hasNextPage ? (
                  <View style={styles.footer}>
                    <Button
                      variant="tertiary"
                      disabled={isFetchingNextPage}
                      onPress={() => fetchNextPage()}
                    >
                      {isFetchingNextPage ? 'Loading…' : 'Load more'}
                    </Button>
                  </View>
                ) : null
              }
            />
          )}
        </QueryState>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  title: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[2] },
  list: { padding: Spacing[4], paddingBottom: TabBarInset + Spacing[4], gap: Spacing[3] },
  count: { paddingBottom: Spacing[1] },
  footer: { alignItems: 'center' },
});
