import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTasks } from '@/api/tasks.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { TaskCard } from '@/features/library/task-card';
import { TabBarInset } from '@/theme/platform';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/theme/tokens';
import type { TaskCategory, TaskDifficulty } from '@/types/task';

const categories = { technique: 'Technique', theory: 'Theory', repertoire: 'Repertoire' };
const difficulties = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function LibraryList() {
  const [category, setCategory] = useState<TaskCategory>();
  const [difficulty, setDifficulty] = useState<TaskDifficulty>();
  const query = useTasks({ category, difficulty });
  const filtered = Boolean(category || difficulty);
  const clearFilters = () => {
    setCategory(undefined);
    setDifficulty(undefined);
  };
  const total = query.data?.pages[0]?.meta.total ?? 0;
  const count = [
    `${total} ${total === 1 ? 'task' : 'tasks'}`,
    category && categories[category],
    difficulty && difficulties[difficulty],
  ]
    .filter(Boolean)
    .join(' · ');
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const tasks = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3" style={styles.title}>
          Task library
        </ThemedText>

        <View style={styles.filters}>
          <ThemedText type="label">Category</ThemedText>
          <View style={styles.chips}>
            {(Object.keys(categories) as TaskCategory[]).map((value) => (
              <Chip
                key={value}
                label={categories[value]}
                selected={category === value}
                onPress={() => setCategory(category === value ? undefined : value)}
              />
            ))}
          </View>
          <ThemedText type="label">Difficulty</ThemedText>
          <View style={styles.chips}>
            {(Object.keys(difficulties) as TaskDifficulty[]).map((value) => (
              <Chip
                key={value}
                label={difficulties[value]}
                selected={difficulty === value}
                onPress={() => setDifficulty(difficulty === value ? undefined : value)}
              />
            ))}
            {filtered && (
              <Pressable accessibilityRole="button" onPress={clearFilters} style={styles.clear}>
                <ThemedText type="label" style={{ color: Colors.accentRamp[700] }}>
                  Clear
                </ThemedText>
              </Pressable>
            )}
          </View>
          {!query.isPending && !query.isError && query.data && (
            <ThemedText type="body" color="textMuted">
              {count}
            </ThemedText>
          )}
        </View>
        <QueryState
          query={query}
          errorTitle="Couldn't load the library"
          isEmpty={tasks.length === 0}
          empty={
            filtered ? (
              <EmptyState
                title="No tasks match these filters"
                message="Try removing a difficulty."
                actionLabel="Clear filters"
                onAction={clearFilters}
              />
            ) : (
              <EmptyState title="No tasks yet" />
            )
          }
        >
          {() => (
            <FlatList
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
  filters: { paddingHorizontal: Spacing[4], gap: Spacing[2], paddingBottom: Spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  clear: {
    minHeight: 32,
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.neutral[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { alignItems: 'center' },
});
