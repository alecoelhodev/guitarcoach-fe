import { Link } from 'expo-router';
import X from 'lucide-react-native/icons/x';
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
import { Input } from '@/components/ui/input';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { TaskCard } from '@/features/library/task-card';
import { categoryLabels, difficultyLabels } from '@/features/library/task-labels';
import { useDebouncedValue } from '@/features/library/use-debounced-value';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useSessionStore } from '@/stores/session-store';
import {
  Colors,
  IconSize,
  IconStroke,
  MaxContentWidth,
  Radius,
  Spacing,
  TapSlop,
} from '@/theme/tokens';
import type { TaskCategory, TaskDifficulty } from '@/types/task';

const SEARCH_DEBOUNCE_MS = 300;
const CLEAR_WIDTH = 44;

export function LibraryList() {
  // Clears the tab bar and the home indicator under it.
  const bottomPad = useBottomInset() + Spacing[4];
  const [category, setCategory] = useState<TaskCategory>();
  const [difficulty, setDifficulty] = useState<TaskDifficulty>();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  // Emptying the field applies at once; only typing waits for a pause.
  const q = search.trim() === '' ? undefined : debouncedSearch || undefined;
  const query = useTasks({ category, difficulty, q });
  // Hides a control that would only 403. The backend's admin gate is the enforcement.
  const isAdmin = useSessionStore((state) => state.user?.role === 'admin');
  const filtered = Boolean(category || difficulty || q);
  const clearFilters = () => {
    setCategory(undefined);
    setDifficulty(undefined);
    setSearch('');
  };
  const total = query.data?.pages[0]?.meta.total ?? 0;
  const count = [
    `${total} ${total === 1 ? 'task' : 'tasks'}`,
    q && `'${q}'`,
    category && categoryLabels[category],
    difficulty && difficultyLabels[difficulty],
  ]
    .filter(Boolean)
    .join(' · ');
  const {
    listState,
    isRefreshing,
    refresh,
    isFetchingNextPage,
    isNextPageError,
    loadMore: loadNextPage,
    retryNextPage,
  } = usePaginatedList(query);
  const tasks = query.data?.pages.flatMap((page) => page.data) ?? [];
  // Placeholder pages belong to the previous filters; paging them would mix the two lists.
  const loadMore = () => {
    if (!query.isPlaceholderData) loadNextPage();
  };

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
        <View style={styles.title}>
          <ThemedText type="h3">Task library</ThemedText>
          {isAdmin && (
            <View style={styles.adminActions}>
              <Link href="/library/generate" asChild>
                <Button variant="tertiary">Generate</Button>
              </Link>
              <Link href="/library/new" asChild>
                <Button variant="tertiary">New task</Button>
              </Link>
            </View>
          )}
        </View>

        <View style={styles.filters}>
          <View>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search tasks"
              accessibilityLabel="Search tasks"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              maxLength={100}
              style={styles.search}
            />
            {search !== '' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setSearch('')}
                hitSlop={TapSlop}
                style={styles.searchClear}
              >
                <X color={Colors.neutral[600]} size={IconSize.md} strokeWidth={IconStroke} />
              </Pressable>
            )}
          </View>
          <ThemedText type="label">Category</ThemedText>
          <View style={styles.chips}>
            {(Object.keys(categoryLabels) as TaskCategory[]).map((value) => (
              <Chip
                key={value}
                label={categoryLabels[value]}
                selected={category === value}
                onPress={() => setCategory(category === value ? undefined : value)}
              />
            ))}
          </View>
          <ThemedText type="label">Difficulty</ThemedText>
          <View style={styles.chips}>
            {(Object.keys(difficultyLabels) as TaskDifficulty[]).map((value) => (
              <Chip
                key={value}
                label={difficultyLabels[value]}
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
          {!query.isPending && !listState.isError && !query.isPlaceholderData && query.data && (
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
            q ? (
              <EmptyState
                title={`No tasks match '${q}'`}
                message="Try another word, or clear the search and filters."
                actionLabel="Clear"
                onAction={clearFilters}
              />
            ) : filtered ? (
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
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[2],
  },
  adminActions: { flexDirection: 'row', gap: Spacing[1] },
  list: { padding: Spacing[4], gap: Spacing[3] },
  filters: { paddingHorizontal: Spacing[4], gap: Spacing[2], paddingBottom: Spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  search: { paddingRight: CLEAR_WIDTH + Spacing[1] },
  searchClear: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: CLEAR_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
