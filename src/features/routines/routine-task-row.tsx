import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Stepper } from '@/components/ui/stepper';
import { Colors, Spacing } from '@/theme/tokens';
import type { RoutineTaskWithTask } from '@/types/routine';

/** Canvas 04's add sheet prefills 15; a task given a duration for the first time starts there. */
const DEFAULT_MINUTES = 15;

/** `@Min(1)` on the backend — the stepper must never be able to reach 0. */
const MIN_MINUTES = 1;

/** Long enough to swallow a burst of taps; only the last value of a burst is written. */
export const MINUTES_COMMIT_DELAY_MS = 400;

export type RoutineTaskRowProps = {
  routineTask: RoutineTaskWithTask;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  expanded: boolean;
  busy: boolean;
  onToggleExpanded: () => void;
  onMove: (direction: -1 | 1) => void;
  onSetMinutes: (minutes: number | undefined) => void;
  onRemove: () => void;
};

/**
 * Canvas 06: a collapsed row is number, title and duration; tapping it expands the controls
 * in place. Move up / down live on the expanded row only — with them on every row the list
 * is a wall of buttons, and canvas 2c puts them on the active row too.
 */
export function RoutineTaskRow({
  routineTask,
  index,
  isFirst,
  isLast,
  expanded,
  busy,
  onToggleExpanded,
  onMove,
  onSetMinutes,
  onRemove,
}: RoutineTaskRowProps) {
  const [minutes, setMinutes] = useMinutesDraft(
    routineTask.targetDurationMinutes ?? undefined,
    onSetMinutes,
  );
  const title = routineTask.task.title;

  return (
    <Card style={expanded ? styles.cardExpanded : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={title}
        onPress={onToggleExpanded}
        style={styles.summary}
      >
        <ThemedText type="body" color="textMuted" style={styles.index}>
          {index + 1}
        </ThemedText>
        <ThemedText type="label" style={styles.title}>
          {title}
        </ThemedText>
        {/* An em-dash, not "0 min": a task with no target is valid and must not read as zero. */}
        <ThemedText type="body" color="textMuted">
          {minutes != null ? `${minutes} min` : '—'}
        </ThemedText>
      </Pressable>

      {expanded && (
        <View style={styles.controls}>
          <View style={styles.durationRow}>
            <ThemedText type="overline" color="textMuted">
              Target duration
            </ThemedText>
            {minutes != null ? (
              <Stepper
                minutes={minutes}
                min={MIN_MINUTES}
                onChange={setMinutes}
                // Decrementing at the floor clears rather than dead-ends, so the value can be
                // removed without the stepper ever producing the 0 the backend rejects.
                onClear={() => setMinutes(undefined)}
              />
            ) : (
              <Button
                variant="tertiary"
                disabled={busy}
                onPress={() => setMinutes(DEFAULT_MINUTES)}
              >
                Add duration
              </Button>
            )}
          </View>

          <View style={styles.actions}>
            <Button
              variant="tertiary"
              style={styles.action}
              disabled={busy || isFirst}
              onPress={() => onMove(-1)}
            >
              Move up
            </Button>
            <Button
              variant="tertiary"
              style={styles.action}
              disabled={busy || isLast}
              onPress={() => onMove(1)}
            >
              Move down
            </Button>
            {/* No confirmation — re-adding a task is one tap, so a dialog costs more than the
                mistake does. Canvas 06 draws a plain Remove. */}
            <Button variant="tertiary" style={styles.action} disabled={busy} onPress={onRemove}>
              <ThemedText type="label" style={styles.removeLabel}>
                Remove
              </ThemedText>
            </Button>
          </View>
        </View>
      )}
    </Card>
  );
}

type Draft = { minutes: number | undefined; saved: number | undefined; committed: boolean };

/**
 * The stepper steps a local value and writes only the last one of a burst. Stepping the saved
 * value instead lost taps — every tap in a burst computed from the same stale number — and
 * sent a PATCH per tap. A pending value is still written if the row unmounts first.
 */
function useMinutesDraft(saved: number | undefined, commit: (minutes: number | undefined) => void) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flushPending = useRef<(() => void) | null>(null);

  // A written draft gives way once the cache moves: to the optimistic value, or back on rollback.
  if (draft?.committed && draft.saved !== saved) setDraft(null);

  useEffect(() => {
    const pending = flushPending;
    return () => {
      clearTimeout(timer.current);
      pending.current?.();
    };
  }, []);

  function change(minutes: number | undefined) {
    const from = draft ? draft.saved : saved;
    setDraft({ minutes, saved: from, committed: false });

    const flush = () => {
      flushPending.current = null;
      if (minutes === from) {
        setDraft(null);
        return;
      }
      setDraft({ minutes, saved: from, committed: true });
      commit(minutes);
    };
    clearTimeout(timer.current);
    flushPending.current = flush;
    timer.current = setTimeout(flush, MINUTES_COMMIT_DELAY_MS);
  }

  return [draft ? draft.minutes : saved, change] as const;
}

const styles = StyleSheet.create({
  cardExpanded: { borderColor: Colors.accent },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  index: { width: 14 },
  title: { flex: 1 },
  controls: { gap: Spacing[3] },
  durationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: Spacing[2] },
  action: { flex: 1 },
  removeLabel: { color: Colors.dangerRamp[700] },
});
