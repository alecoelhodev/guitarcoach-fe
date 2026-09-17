import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useAddRoutineTask, useRoutines } from '@/api/routines.queries';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorPanel } from '@/components/ui/error-panel';
import { QueryState } from '@/components/ui/query-state';
import { Sheet } from '@/components/ui/sheet';
import { Stepper } from '@/components/ui/stepper';
import { useToastStore } from '@/stores/toast-store';
import { Colors, Spacing } from '@/theme/tokens';
import type { Routine } from '@/types/routine';

type Failure = { kind: 'conflict' | 'error'; text: string };

/** Canvas 04's stepper is prefilled at 15. */
const DEFAULT_MINUTES = 15;

/** `@Min(1)` on the backend — the stepper must never be able to reach 0. */
const MIN_MINUTES = 1;

/**
 * Canvas 04's "Add to Routine" sheet, opened from a task's detail screen.
 *
 * Canvas 04 also draws a "Find a routine" field. `FindRoutinesQueryDto` has no search
 * parameter, so it is omitted rather than faked over the loaded page — that would appear to
 * search every routine while silently missing the ones not yet paged in. Recorded in
 * `specs/11-blocked-and-out-of-scope.md`.
 */
export function AddToRoutineSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);

  // Active only: canvas 04's annotation is explicit that a task added to an archived routine
  // has nowhere useful to go.
  const query = useRoutines({ status: 'active' });
  const routines = query.data?.pages.flatMap((page) => page.data) ?? [];
  const activeCount = query.data?.pages[0]?.meta.total ?? 0;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | undefined>(DEFAULT_MINUTES);
  // Two genuinely different states, not one with an optional field: canvas 04b gives the
  // conflict a sentence and no retry, and the failure a heading and a retry.
  const [failure, setFailure] = useState<Failure | null>(null);

  const selected = routines.find((routine: Routine) => routine.id === selectedId);
  const addRoutineTask = useAddRoutineTask(selectedId ?? '');

  async function add() {
    if (!selected) return;
    setFailure(null);

    try {
      await addRoutineTask.mutateAsync({
        taskId,
        // Optional by design, and `@Min(1)` — omit the key rather than sending a zero.
        ...(minutes != null ? { targetDurationMinutes: minutes } : {}),
      });
    } catch (error) {
      // 409 is a designed state, not a failure: `@@id([routineId, taskId])` makes a task unique
      // per routine, so this is the app telling the user where the task already is. Canvas 04b
      // gives it a message and no title, unlike the generic failure below.
      if (error instanceof ApiError && error.status === 409) {
        setFailure({
          kind: 'conflict',
          text: `This task is already in ${selected.title}. Change its duration there instead.`,
        });
        return;
      }
      setFailure({ kind: 'error', text: describeError(error, "Couldn't add the task").title });
      return;
    }

    showToast(`Added to ${selected.title}`, 'success');
    onClose();
  }

  return (
    <Sheet visible onClose={onClose} title="Add to which routine?">
      <ThemedText type="body" color="textMuted">
        {activeCount} active
      </ThemedText>

      <QueryState
        query={query}
        errorTitle="Couldn't load your routines"
        isEmpty={routines.length === 0}
        empty={
          <EmptyState title="No active routines" message="Create one, then add this task to it." />
        }
      >
        {() => (
          <View style={styles.list}>
            {routines.map((routine: Routine) => (
              <RoutineOption
                key={routine.id}
                routine={routine}
                selected={routine.id === selectedId}
                onPress={() => {
                  setSelectedId(routine.id);
                  setFailure(null);
                }}
              />
            ))}
            {query.hasNextPage && (
              <Button
                variant="tertiary"
                disabled={query.isFetchingNextPage}
                onPress={() => query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more routines'}
              </Button>
            )}
          </View>
        )}
      </QueryState>

      {/* Canvas 04: "Duration is optional and prefilled — progressive disclosure keeps it
          inside the sheet instead of a form on the details screen." */}
      <View style={styles.durationRow}>
        <ThemedText type="overline" color="textMuted">
          Target duration
        </ThemedText>
        {minutes != null ? (
          <Stepper
            minutes={minutes}
            min={MIN_MINUTES}
            onChange={setMinutes}
            // Decrementing at the floor clears instead of dead-ending, so the duration can be
            // dropped without the stepper ever producing the 0 the backend rejects.
            onClear={() => setMinutes(undefined)}
          />
        ) : (
          <Button variant="tertiary" onPress={() => setMinutes(DEFAULT_MINUTES)}>
            Add duration
          </Button>
        )}
      </View>

      {failure && (
        <ErrorPanel
          title={failure.text}
          // A conflict is not worth retrying — the same request produces the same 409. The
          // fix is on the routine, which the copy points at.
          onRetry={failure.kind === 'error' ? () => void add() : undefined}
          onDismiss={() => setFailure(null)}
        />
      )}

      <Button
        block
        disabled={!selected}
        loading={addRoutineTask.isPending}
        loadingLabel="Adding…"
        onPress={() => void add()}
      >
        Add task
      </Button>

      <Button
        variant="tertiary"
        onPress={() => {
          onClose();
          router.push('/routines/new');
        }}
      >
        New routine instead
      </Button>
    </Sheet>
  );
}

function RoutineOption({
  routine,
  selected,
  onPress,
}: {
  routine: Routine;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={routine.title}
      onPress={onPress}
    >
      <Card style={selected ? styles.selectedCard : undefined}>
        <View style={styles.optionRow}>
          <View style={styles.tick}>
            {selected && <Check color={Colors.accent} size={16} strokeWidth={3} />}
          </View>
          <ThemedText type="label" style={styles.optionTitle}>
            {routine.title}
          </ThemedText>
          <ThemedText type="body" color="textMuted">
            {routine.taskCount} {routine.taskCount === 1 ? 'task' : 'tasks'}
          </ThemedText>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing[2] },
  selectedCard: { borderColor: Colors.accent },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  tick: { width: 20, alignItems: 'center' },
  optionTitle: { flex: 1 },
  durationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
