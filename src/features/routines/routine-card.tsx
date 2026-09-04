import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Colors } from '@/theme/tokens';
import type { Routine } from '@/types/routine';

export function RoutineCard({ routine }: { routine: Routine }) {
  return (
    <Link href={{ pathname: '/routines/[id]', params: { id: routine.id } }} asChild>
      <Card>
        <View style={styles.row}>
          <ThemedText type="h5" style={styles.title}>
            {routine.title}
          </ThemedText>
          {/* Canvas 05 leaves active routines unbadged and marks only archived ones. */}
          {routine.status === 'archived' && <Badge label="Archived" />}
          <ChevronRight color={Colors.neutral[700]} size={16} strokeWidth={2.75} />
        </View>

        {routine.notes && (
          <ThemedText type="body" color="textMuted" numberOfLines={2}>
            {routine.notes}
          </ThemedText>
        )}
      </Card>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
});
