import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { sumSessionMinutes } from '@/lib/duration';
import { Colors, Spacing } from '@/theme/tokens';
import type { PracticeSession } from '@/types/session';

export type ThisWeekCardProps = {
  /** Sessions already filtered to the current week by the caller. */
  sessions: PracticeSession[];
  isPending: boolean;
  /** Canvas 2a sets the figures at 38px on web against 34px on mobile. */
  figureSize?: number;
};

/**
 * Canvas 02 is explicit that minutes and session count are the only two progress
 * numbers the backend can honestly support — there is no analytics endpoint and
 * no total-duration field, so both are client-side sums.
 */
export function ThisWeekCard({ sessions, isPending, figureSize = 34 }: ThisWeekCardProps) {
  if (isPending) {
    return (
      <Card>
        <Heading />
        <Skeleton width="45%" />
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card quiet>
        <Heading />
        <ThemedText type="body" color="textMuted">
          Nothing logged yet. Your minutes and sessions appear here after your first practice.
        </ThemedText>
      </Card>
    );
  }

  const totalMinutes = sessions.reduce((sum, session) => sum + sumSessionMinutes(session), 0);

  return (
    <Card>
      <Heading />
      <View style={styles.figures}>
        <Figure value={totalMinutes} label="minutes" size={figureSize} />
        <View style={[styles.figureDivider, { height: figureSize }]} />
        <Figure value={sessions.length} label="sessions" size={figureSize} />
      </View>
    </Card>
  );
}

function Heading() {
  return (
    <ThemedText type="overline" color="textMuted">
      This week
    </ThemedText>
  );
}

/** Canvas `.big` — the only oversized numerals in the app outside the session clock. */
function Figure({ value, label, size }: { value: number; label: string; size: number }) {
  return (
    <View>
      <ThemedText type="display" style={{ fontSize: size, lineHeight: size }}>
        {value}
      </ThemedText>
      <ThemedText type="body" color="textMuted">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  figures: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[4],
  },
  figureDivider: {
    width: 1,
    backgroundColor: Colors.neutral[300],
  },
});
