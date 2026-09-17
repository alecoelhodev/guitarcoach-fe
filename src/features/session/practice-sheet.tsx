import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRoutines } from '@/api/routines.queries';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { Sheet } from '@/components/ui/sheet';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useStartPractice } from '@/features/session/use-start-practice';
import { formatRoutineMeta } from '@/lib/routine-meta';
import { Spacing } from '@/theme/tokens';
import type { Routine } from '@/types/routine';

/**
 * Canvas 02b. Practice is the dominant affordance in the whole design — the raised centre
 * button on mobile, the first filled rail item on web — and the canvas is explicit that it
 * opens a sheet rather than navigating: "Routines listed inline so a one-tap start needs no
 * second navigation."
 *
 * Nothing here writes to the server. Starting practice seeds local state and opens the active
 * session; the session record is one write, at Finish.
 */
export function PracticeSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const startPractice = useStartPractice();
  const startSession = useActiveSessionStore((state) => state.start);

  // Mounted only while open (see the provider), so this fires when the sheet opens rather
  // than on every screen that happens to sit inside the shell.
  const query = useRoutines({ status: 'active' });
  const routines = query.data?.pages.flatMap((page) => page.data) ?? [];

  function startBlank() {
    startSession({ tasks: [] });
    onClose();
    router.push('/session/active');
  }

  return (
    <Sheet visible onClose={onClose} title="Start practice">
      <ThemedText type="overline" color="textMuted">
        From a routine
      </ThemedText>

      <QueryState
        query={query}
        errorTitle="Couldn't load your routines"
        isEmpty={routines.length === 0}
        empty={<EmptyState title="No active routines" message="Start a blank session instead." />}
      >
        {() => (
          <View style={styles.list}>
            {routines.map((routine: Routine) => (
              <RoutineRow
                key={routine.id}
                routine={routine}
                busy={startPractice.isPending && startPractice.variables?.routine.id === routine.id}
                onPress={() => {
                  onClose();
                  startPractice.mutate({ routine });
                }}
              />
            ))}
            {query.hasNextPage && (
              <Button
                variant="tertiary"
                disabled={query.isFetchingNextPage}
                onPress={() => query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </View>
        )}
      </QueryState>

      <Button variant="secondary" block onPress={startBlank}>
        Start a blank session
      </Button>
      <ThemedText type="body" color="textMuted" style={styles.helper}>
        Pick tasks from the library as you go.
      </ThemedText>
    </Sheet>
  );
}

function RoutineRow({
  routine,
  busy,
  onPress,
}: {
  routine: Routine;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={routine.title} onPress={onPress}>
      <Card>
        <ThemedText type="h5">{routine.title}</ThemedText>
        <ThemedText type="body" color="textMuted">
          {busy ? 'Starting…' : formatRoutineMeta(routine)}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing[2] },
  helper: { textAlign: 'center' },
});
