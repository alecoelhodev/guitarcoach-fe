import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTasks } from '@/api/tasks.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { TaskCard } from '@/features/library/task-card';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { Colors, MaxContentWidth, Radius, Spacing, TapSlop } from '@/theme/tokens';
import type { TaskCategory, TaskDifficulty } from '@/types/task';

const categories = { technique: 'Technique', theory: 'Theory', repertoire: 'Repertoire' };
const difficulties = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function LibraryList() {
  // Clears the tab bar and the home indicator under it.
  const bottomPad = useBottomInset() + Spacing[4];
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
  const {
    listState,
    isRefreshing,
    refresh,
    isFetchingNextPage,
    isNextPageError,
    loadMore,
    retryNextPage,
  } = usePaginatedList(query);
  const tasks = query.data?.pages.flatMap((page) => page.data) ?? [];

  const footer = isNextPageError ? (
    <View style={styles.footer}>
      <ThemedText type="body" color="textMuted">
        {"Couldn't load more tasks."}
      </ThemedText>
      <Button variant="tertiary" onPress={retryNextPage}>
        Try again
      </Button>
    </View>
  ) : isFetchingNextPage ? (
    <View style={styles.footer}>
      <ActivityIndicator color={Colors.accentRamp[700]} accessibilityLabel="Loading more tasks" />
    </View>
  ) : null;

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
              <Pressable
                accessibilityRole="button"
                onPress={clearFilters}
                hitSlop={TapSlop}
                style={styles.clear}
              >
                <ThemedText type="label" style={{ color: Colors.accentRamp[700] }}>
                  Clear
                </ThemedText>
              </Pressable>
            )}
          </View>
          {!query.isPending && !listState.isError && query.data && (
            <ThemedText type="body" color="textMuted">
              {count}
            </ThemedText>
          )}
        </View>
        <QueryState
          query={listState}
          skeleton={<SkeletonList />}
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
              testID="library-list"
              data={tasks}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={refresh}
                  tintColor={Colors.accentRamp[700]}
                  colors={[Colors.accentRamp[700]]}
                />
              }
              keyExtractor={(task) => task.id}
              renderItem={({ item }) => <TaskCard task={item} />}
              contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={footer}
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
  list: { padding: Spacing[4], gap: Spacing[3] },
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
  footer: { alignItems: 'center', gap: Spacing[2] },
});
