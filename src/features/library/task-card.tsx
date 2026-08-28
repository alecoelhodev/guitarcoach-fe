import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

export function TaskCard({ task }: { task: Task }) {
  return (
    <Link href={{ pathname: '/library/[id]', params: { id: task.id } }} asChild>
      <Card style={styles.card}>
        <ThemedText type="h5">{task.title}</ThemedText>
        <View style={styles.badges}>
          {task.category && <Badge label={task.category} variant="category" />}
          {task.difficulty && <Badge label={task.difficulty} variant="difficulty" />}
        </View>
      </Card>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing[2] },
  badges: { flexDirection: 'row', gap: Spacing[2] },
});
