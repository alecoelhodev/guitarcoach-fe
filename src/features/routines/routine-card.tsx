import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { describeError } from '@/api/errors';
import { useUpdateRoutine } from '@/api/routines.queries';
import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useStartPractice } from '@/features/session/use-start-practice';
import { formatRoutineMeta } from '@/lib/routine-meta';
import { useToastStore } from '@/stores/toast-store';
import { Colors, Spacing } from '@/theme/tokens';
import type { Routine } from '@/types/routine';

export function RoutineCard({ routine }: { routine: Routine }) {
  const archived = routine.status === 'archived';

  return (
    <Card style={archived ? styles.archived : undefined}>
      {/* The tappable region is the card body, not the whole card: a Start Practice or
          Restore button nested inside a Link would put one pressable inside another. */}
      <Link href={{ pathname: '/routines/[id]', params: { id: routine.id } }} asChild>
        <Pressable style={styles.body}>
          <View style={styles.row}>
            <ThemedText type="h5" style={styles.title}>
              {routine.title}
            </ThemedText>
            {/* Canvas 05 leaves active routines unbadged and marks only archived ones. */}
            {archived && <Badge label="Archived" />}
            <ChevronRight color={Colors.neutral[700]} size={16} strokeWidth={2.75} />
          </View>

          <ThemedText type="body" color="textMuted">
            {formatRoutineMeta(routine)}
          </ThemedText>

          {routine.notes && (
            <ThemedText type="body" color="textMuted" numberOfLines={2}>
              {routine.notes}
            </ThemedText>
          )}
        </Pressable>
      </Link>

      {/* Canvas 05b: archived routines are reviewable and restorable, never startable. */}
      {archived ? (
        <RestoreButton routineId={routine.id} />
      ) : (
        <StartPracticeButton routine={routine} />
      )}
    </Card>
  );
}

function StartPracticeButton({ routine }: { routine: Routine }) {
  const startPractice = useStartPractice();

  // No tasks passed: the list response carries counts, not the tasks themselves, so the hook
  // pays one fetch on press rather than one per card on every render of the list.
  return (
    <Button
      block
      loading={startPractice.isPending}
      loadingLabel="Loading…"
      onPress={() => startPractice.mutate({ routine })}
    >
      Start Practice
    </Button>
  );
}

function RestoreButton({ routineId }: { routineId: string }) {
  const restore = useUpdateRoutine(routineId);
  const showToast = useToastStore((state) => state.show);

  return (
    <Button
      variant="secondary"
      block
      loading={restore.isPending}
      loadingLabel="Restoring…"
      onPress={() =>
        restore.mutate(
          { status: 'active' },
          {
            onError: (error) =>
              showToast(describeError(error, "Couldn't restore this routine").title, 'error'),
          },
        )
      }
    >
      Restore to active
    </Button>
  );
}

const styles = StyleSheet.create({
  // Canvas 05b dims the archived card rather than recolouring it.
  archived: { opacity: 0.75 },
  // A single object, never an array: expo-router's Slot throws on an array style, but only
  // in development, so a production build would hide it (see AGENTS.md).
  body: { gap: Spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
});
