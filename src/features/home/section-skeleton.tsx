import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/theme/tokens';

/**
 * A Home section's header plus a placeholder card.
 *
 * `ActiveRoutines` and `RecentSessions` used to render `null` until their data arrived, while
 * "Today's practice" and "This week" above them showed skeletons — so Home settled in two
 * stages and the page jumped once the lower half appeared.
 */
export function SectionSkeleton({ title }: { title: string }) {
  return (
    <>
      <View style={styles.header}>
        <ThemedText type="overline" color="textMuted">
          {title}
        </ThemedText>
      </View>
      <Card>
        <Skeleton width="55%" height={16} />
        <Skeleton width="80%" />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: Spacing[2] },
});
