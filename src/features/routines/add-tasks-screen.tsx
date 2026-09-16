import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useAddRoutineTask, useRoutineTasks } from '@/api/routines.queries';
import { useTasks } from '@/api/tasks.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChecklistRow } from '@/components/ui/checklist-row';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { useToastStore } from '@/stores/toast-store';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

/**
 * The library, in pick mode. A routine's tasks are read through the same query the builder
 * uses, so tasks already in it are filtered out before they can be tapped — a duplicate is a
 * 409, and the cheapest way to handle an error is not to offer it. The 409 is still handled
 * below, because the list can go stale between render and tap.
 */
export function AddTasksScreen({ routineId }: { routineId: string }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);

  const tasksQuery = useTasks();
  const routineTasksQuery = useRoutineTasks(routineId);
  const addRoutineTask = useAddRoutineTask(routineId);

  const [selected, setSelected] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const alreadyIn = new Set((routineTasksQuery.data ?? []).map((task) => task.taskId));
  const available = (tasksQuery.data?.pages.flatMap((page) => page.data) ?? []).filter(
    (task: Task) => !alreadyIn.has(task.id),
  );

  function toggle(taskId: string) {
    setSelected((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }

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

    for (const taskId of selected) {
      try {
        await addRoutineTask.mutateAsync({ taskId });
        added += 1;
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
        setSelected((current) => current.slice(added));
        return;
      }
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

        <QueryState
          query={tasksQuery}
          errorTitle="Couldn't load the library"
          isEmpty={available.length === 0}
          empty={
            <EmptyState
              title="Nothing left to add"
              message="Every task in the library is already in this routine."
            />
          }
        >
          {() => (
            <FlatList
              data={available}
              keyExtractor={(task) => task.id}
              renderItem={({ item }) => (
                <Card>
                  <ChecklistRow
                    label={item.title}
                    checked={selected.includes(item.id)}
                    onToggle={() => toggle(item.id)}
                  />
                </Card>
              )}
              contentContainerStyle={styles.list}
              ListFooterComponent={
                tasksQuery.hasNextPage ? (
                  <View style={styles.footer}>
                    <Button
                      variant="tertiary"
                      disabled={tasksQuery.isFetchingNextPage}
                      onPress={() => tasksQuery.fetchNextPage()}
                    >
                      {tasksQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
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
          disabled={selected.length === 0}
          loading={adding}
          loadingLabel="Adding…"
          onPress={() => void addSelected()}
        >
          {selected.length === 1 ? 'Add 1 task' : `Add ${selected.length} tasks`}
        </Button>
      </SafeAreaView>
    </ThemedView>
  );
}

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
