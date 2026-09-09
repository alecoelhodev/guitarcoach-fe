import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatRoutineMeta } from '@/lib/routine-meta';
import { Colors, Spacing } from '@/theme/tokens';
import type { Routine } from '@/types/routine';

/** Canvas 02 fixes the mobile strip cards at 140px so the next one peeks in. */
const STRIP_CARD_WIDTH = 140;

export type ActiveRoutinesProps = {
  routines: Routine[];
  /** Canvas 2a lays these out as a three-column grid with a Start action per card. */
  isWide?: boolean;
};

/**
 * Canvas 02 "Active routines" (a horizontal strip) and 2a (a three-column grid).
 *
 * The section is omitted entirely when there are no active routines — canvas 02c
 * replaces the whole screen with the new-user state in that case.
 */
export function ActiveRoutines({ routines, isWide = false }: ActiveRoutinesProps) {
  if (routines.length === 0) return null;

  return (
    <>
      <View style={styles.sectionHeader}>
        <ThemedText type="overline" color="textMuted">
          Active routines
        </ThemedText>
        <Link href="/(app)/(main)/(tabs)/routines" asChild>
          <ThemedText type="label" style={styles.link}>
            {isWide ? 'All routines' : 'All'}
          </ThemedText>
        </Link>
      </View>

      {isWide ? (
        <View style={styles.grid}>
          {routines.map((routine) => (
            <View key={routine.id} style={styles.gridCell}>
              <RoutineTile routine={routine} showStart />
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {routines.map((routine) => (
            <View key={routine.id} style={styles.stripCell}>
              <RoutineTile routine={routine} />
            </View>
          ))}
        </ScrollView>
      )}
    </>
  );
}

function RoutineTile({ routine, showStart = false }: { routine: Routine; showStart?: boolean }) {
  const href = { pathname: '/routines/[id]', params: { id: routine.id } } as const;

  // Canvas 02's strip card is itself the affordance; 2a's grid card adds a Start
  // button, so only that one nests a second link.
  if (!showStart) {
    return (
      <Link href={href} asChild>
        <Card style={styles.tile}>
          <ThemedText type="label" numberOfLines={2}>
            {routine.title}
          </ThemedText>
          <ThemedText type="body" color="textMuted">
            {formatRoutineMeta(routine)}
          </ThemedText>
        </Card>
      </Link>
    );
  }

  return (
    <Card style={styles.tile}>
      <ThemedText type="label" numberOfLines={2}>
        {routine.title}
      </ThemedText>
      <ThemedText type="body" color="textMuted">
        {formatRoutineMeta(routine)}
      </ThemedText>
      <Link href={href} asChild>
        <Button variant="tertiary">
          <ButtonText>Start</ButtonText>
        </Button>
      </Link>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Canvas uses accent-700 for links and small accent text, never the base accent.
  link: { color: Colors.accentRamp[700] },
  strip: { gap: Spacing[2] },
  stripCell: { width: STRIP_CARD_WIDTH },
  grid: { flexDirection: 'row', gap: Spacing[2] },
  gridCell: { flex: 1 },
  tile: { flex: 1 },
});
