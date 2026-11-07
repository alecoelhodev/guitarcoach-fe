import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useAddRoutineTask, useInvalidateRoutines, useRoutineTasks } from '@/api/routines.queries';
import { useTasks } from '@/api/tasks.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChecklistRow } from '@/components/ui/checklist-row';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { SearchField } from '@/components/ui/search-field';
import { SkeletonList } from '@/components/ui/skeleton';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useSearchQuery } from '@/hooks/use-search-query';
import { useToastStore } from '@/stores/toast-store';
import { Colors, MaxContentWidth, Spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

/**
 * The library, in pick mode. A routine's tasks are read through the same query the builder
 * uses, so tasks already in it are filtered out before they can be tapped — a duplicate is a
 * 409, and the cheapest way to handle an error is not to offer it. The 409 is still handled
 * below, because the list can go stale between render and tap. The selection is a set of ids,
 * so it survives a search: tasks ticked under one search are still added after the next.
 */
export function AddTasksScreen({ routineId }: { routineId: string }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);

  const [search, setSearch] = useState('');
  const q = useSearchQuery(search);
  const tasksQuery = useTasks({ q });
  const {
    listState,
    isRefreshing,
    refresh,
    hasNextPage,
    isFetchingNextPage,
    isNextPageError,
    loadMore: loadNextPage,
    retryNextPage,
  } = usePaginatedList(tasksQuery);
  // Placeholder pages belong to the previous search; paging them would mix the two lists.
  const loadMore = () => {
    if (!tasksQuery.isPlaceholderData) loadNextPage();
  };
  const routineTasksQuery = useRoutineTasks(routineId);
  const addRoutineTask = useAddRoutineTask(routineId);
  const invalidateRoutines = useInvalidateRoutines();

  const [selection] = useState(createSelection);
  const selectedCount = useStore(selection, (state) => state.ids.size);
  const [failure, setFailure] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const alreadyIn = new Set((routineTasksQuery.data ?? []).map((task) => task.taskId));
  const available = (tasksQuery.data?.pages.flatMap((page) => page.data) ?? []).filter(
    (task: Task) => !alreadyIn.has(task.id),
  );

  /**
   * Sequential, never `Promise.all`. `@@unique([routineId, position])` plus a server-side
   * append at `max + 1` means concurrent adds race for the same position and all but one 409.
   * `position` is omitted entirely so the backend does the appending — supplying one only
   * creates a conflict to lose.
   */
  async function addSelected() {
    setAdding(true);
    setFailure(null);
    let added = 0;

    try {
      // A Set iterates in insertion order, so tasks are still added in the order picked.
      for (const taskId of selection.getState().ids) {
        await addRoutineTask.mutateAsync({ taskId });
        added += 1;
      }
    } catch (error) {
      const alreadyPresent = error instanceof ApiError && error.status === 409;
      setFailure(
        alreadyPresent
          ? 'One of those tasks is already in this routine. Change its duration there instead.'
          : describeError(error, "Couldn't add the task").title,
      );
      setAdding(false);
      // Keep what landed: the tasks already added are real, and re-running the whole
      // selection would 409 on every one of them.
      selection.setState(({ ids }) => ({ ids: new Set([...ids].slice(added)) }));
      return;
    } finally {
      // Once for the batch, success or not: a 409 means this screen's view was stale too.
      void invalidateRoutines();
    }

    setAdding(false);
    showToast(added === 1 ? 'Task added' : `${added} tasks added`, 'success');
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="h3" style={styles.title}>
            Add tasks
          </ThemedText>
          <Button variant="tertiary" onPress={() => router.back()}>
            Cancel
          </Button>
        </View>

        <SearchField value={search} onChangeText={setSearch} />

        {/* Without the routine's own tasks the filter above is a no-op, so the list offers
            tasks that are already in the routine and the first of them 409s mid-batch. The
            screen still works — the 409 is handled — but the user deserves to know why. */}
        {routineTasksQuery.isError && (
          <Banner
            tone="info"
            title="This list may include tasks you already added"
            message="We couldn't check what's already in this routine."
            actionLabel="Try again"
            onAction={() => routineTasksQuery.refetch()}
          />
        )}

        <QueryState
          query={listState}
          skeleton={<SkeletonList />}
          errorTitle="Couldn't load the library"
          isEmpty={available.length === 0}
          empty={
            q ? (
              <EmptyState
                title={`No tasks match '${q}'`}
                message="Try another word, or clear the search."
                actionLabel="Clear"
                onAction={() => setSearch('')}
              />
            ) : (
              <EmptyState
                title="Nothing left to add"
                message="Every task in the library is already in this routine."
              />
            )
          }
        >
          {() => (
            <FlatList
              data={available}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={refresh}
                  tintColor={Colors.accentRamp[700]}
                  colors={[Colors.accentRamp[700]]}
                />
              }
              keyExtractor={(task) => task.id}
              renderItem={({ item }) => <SelectableTask task={item} selection={selection} />}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              ListFooterComponent={
                isNextPageError ? (
                  <View style={styles.footer}>
                    <ThemedText type="body" color="textMuted">
                      {"Couldn't load more tasks."}
                    </ThemedText>
                    <Button variant="tertiary" onPress={retryNextPage}>
                      Try again
                    </Button>
                  </View>
                ) : hasNextPage ? (
                  <View style={styles.footer}>
                    <Button variant="tertiary" disabled={isFetchingNextPage} onPress={loadMore}>
                      {isFetchingNextPage ? 'Loading…' : 'Load more'}
                    </Button>
                  </View>
                ) : null
              }
            />
          )}
        </QueryState>

        {failure && <Banner tone="error" title={failure} />}

        <Button
          block
          disabled={selectedCount === 0}
          loading={adding}
          loadingLabel="Adding…"
          onPress={() => void addSelected()}
        >
          {selectedCount === 1 ? 'Add 1 task' : `Add ${selectedCount} tasks`}
        </Button>
      </SafeAreaView>
    </ThemedView>
  );
}

type Selection = StoreApi<{ ids: ReadonlySet<string> }>;

const createSelection = (): Selection => createStore(() => ({ ids: new Set<string>() }));

/**
 * Each row subscribes to its own membership, so a toggle re-renders the row that changed
 * rather than every row: `renderItem` closes over the stable store, never the selection.
 */
const SelectableTask = memo(function SelectableTask({
  task,
  selection,
}: {
  task: Task;
  selection: Selection;
}) {
  const checked = useStore(selection, (state) => state.ids.has(task.id));

  return (
    <Card>
      <ChecklistRow
        label={task.title}
        checked={checked}
        onToggle={() =>
          selection.setState(({ ids }) => {
            const next = new Set(ids);
            if (!next.delete(task.id)) next.add(task.id);
            return { ids: next };
          })
        }
      />
    </Card>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  title: { flex: 1 },
  list: { gap: Spacing[2], paddingBottom: Spacing[4] },
  footer: { alignItems: 'center', paddingTop: Spacing[3] },
});
