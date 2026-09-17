import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useTasks } from '@/api/tasks.queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChecklistRow } from '@/components/ui/checklist-row';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { Sheet } from '@/components/ui/sheet';
import { useActiveSessionStore } from '@/features/session/session-store';
import { Spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

/**
 * Canvas 07b's blank-session picker: the library, in pick mode, over the active session.
 *
 * Canvas 07b also draws a "Search the library" field. `FindTasksQueryDto` is
 * page/limit/category/difficulty only — there is no search parameter — so it is omitted rather
 * than faked over the loaded page, which would appear to search the catalog while missing
 * everything not yet paged in. Same reason canvas 03's and canvas 04's search fields are out of
 * scope; see `specs/11-blocked-and-out-of-scope.md`.
 */
export function AddSessionTasks({ onClose }: { onClose: () => void }) {
  // Mounted only while open, so the library is not fetched behind every active session.
  const query = useTasks();
  const sessionTasks = useActiveSessionStore((state) => state.tasks);
  const addTask = useActiveSessionStore((state) => state.addTask);

  const [selected, setSelected] = useState<string[]>([]);

  // A task may appear at most once per session, so the ones already picked are filtered out
  // rather than offered and rejected. The store dedupes again on add — this list can go stale.
  const alreadyIn = new Set(sessionTasks.map((task) => task.taskId));
  const available = (query.data?.pages.flatMap((page) => page.data) ?? []).filter(
    (task: Task) => !alreadyIn.has(task.id),
  );

  function toggle(taskId: string) {
    setSelected((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }

  function addSelected() {
    for (const taskId of selected) {
      const task = available.find((candidate: Task) => candidate.id === taskId);
      if (task)
        addTask({ taskId: task.id, title: task.title, durationMinutes: 0, completed: false });
    }
    setSelected([]);
    onClose();
  }

  return (
    <Sheet visible onClose={onClose} title="Add tasks">
      <QueryState
        query={query}
        errorTitle="Couldn't load the library"
        isEmpty={available.length === 0}
        empty={
          <EmptyState
            title="Nothing left to add"
            message="Every task in the library is already in this session."
          />
        }
      >
        {() => (
          <FlatList
            data={available}
            keyExtractor={(task) => task.id}
            style={styles.list}
            renderItem={({ item }) => (
              <Card>
                <ChecklistRow
                  label={item.title}
                  checked={selected.includes(item.id)}
                  onToggle={() => toggle(item.id)}
                />
              </Card>
            )}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={
              query.hasNextPage ? (
                <View style={styles.footer}>
                  <Button
                    variant="tertiary"
                    disabled={query.isFetchingNextPage}
                    onPress={() => query.fetchNextPage()}
                  >
                    {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
                  </Button>
                </View>
              ) : null
            }
          />
        )}
      </QueryState>

      {/* Canvas 07b labels the confirm with the count rather than a bare "Add". */}
      <Button block disabled={selected.length === 0} onPress={addSelected}>
        {selected.length === 1 ? 'Add 1 task' : `Add ${selected.length} tasks`}
      </Button>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Bounded so the sheet's dynamic sizing cannot grow past the screen on a long library.
  list: { maxHeight: 320 },
  listContent: { gap: Spacing[2] },
  footer: { alignItems: 'center', paddingTop: Spacing[2] },
});
