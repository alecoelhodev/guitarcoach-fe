import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Routine } from '@/types/routine';

export function RoutineCard({ routine }: { routine: Routine }) {
  return (
    <Link href={{ pathname: '/routines/[id]', params: { id: routine.id } }} asChild>
      <Card style={styles.card}>
        <View style={styles.row}>
          <ThemedText type="h5" style={styles.title}>
            {routine.title}
          </ThemedText>
          <Badge
            label={routine.status}
            variant={routine.status === 'active' ? 'category' : 'neutral'}
          />
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
  card: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { flex: 1 },
});
