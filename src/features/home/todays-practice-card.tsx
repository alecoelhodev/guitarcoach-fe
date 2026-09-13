import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRoutineMeta } from '@/lib/routine-meta';
import { Spacing } from '@/theme/tokens';
import type { Routine } from '@/types/routine';

const TODAYS_PRACTICE = "Today's practice";

export type TodaysPracticeCardProps = {
  routine: Routine;
  /** Task titles in routine order; the canvas joins them with " · " on one line. */
  taskTitles: string[];
  /** Canvas 2a adds a "View routine" tertiary beside Start Practice; mobile has no room. */
  showViewRoutine?: boolean;
  onStartPractice: () => void;
  isStarting?: boolean;
};

/**
 * Canvas 02 / 2a. The routine shown is derived — see `use-todays-practice.ts`;
 * the backend has no scheduled-routine concept.
 */
export function TodaysPracticeCard({
  routine,
  taskTitles,
  showViewRoutine = false,
  onStartPractice,
  isStarting = false,
}: TodaysPracticeCardProps) {
  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="overline" color="textMuted">
          {TODAYS_PRACTICE}
        </ThemedText>
        <View style={styles.spacer} />
        <Badge label={formatRoutineMeta(routine)} />
      </View>

      <ThemedText type="h5">{routine.title}</ThemedText>

      {/* A routine with no tasks yet is a real state — Instant Create can produce
          one — so the line is dropped rather than rendered empty. */}
      {taskTitles.length > 0 && (
        <ThemedText type="body" color="textMuted" numberOfLines={2}>
          {taskTitles.join(' · ')}
        </ThemedText>
      )}

      <View style={styles.actions}>
        {/* Canvas 840: this opens the Active Session pre-loaded, it does not navigate to the
            routine — "View routine" is the one that goes there. */}
        <Button
          style={styles.start}
          onPress={onStartPractice}
          loading={isStarting}
          loadingLabel="Starting…"
        >
          <ButtonText>Start Practice</ButtonText>
        </Button>

        {showViewRoutine && (
          <Link href={{ pathname: '/routines/[id]', params: { id: routine.id } }} asChild>
            <Button variant="tertiary">
              <ButtonText>View routine</ButtonText>
            </Button>
          </Link>
        )}
      </View>
    </Card>
  );
}

/** Same card outline while the routine resolves, so the layout does not jump. */
export function TodaysPracticeSkeleton() {
  return (
    <Card>
      <ThemedText type="overline" color="textMuted">
        {TODAYS_PRACTICE}
      </ThemedText>
      <Skeleton width="60%" height={16} />
      <Skeleton width="85%" />
    </Card>
  );
}

/**
 * Loading has finished and there is no active routine to recommend — every routine is
 * archived. The new-user state (02c) does not apply because the account has history, so the
 * slot keeps a quiet card rather than collapsing and leaving a hole where the primary CTA is.
 */
export function TodaysPracticeEmpty() {
  return (
    <Card quiet>
      <ThemedText type="overline" color="textMuted">
        {TODAYS_PRACTICE}
      </ThemedText>
      <ThemedText type="body" color="textMuted">
        No active routine to pick up. Unarchive one, or build a new routine to practise.
      </ThemedText>
      <Link href="/(app)/(main)/(tabs)/routines" asChild>
        <Button variant="tertiary">
          <ButtonText>Go to routines</ButtonText>
        </Button>
      </Link>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  spacer: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  start: { flex: 1 },
});
