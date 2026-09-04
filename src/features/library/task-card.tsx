import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Colors, Spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

export function TaskCard({ task }: { task: Task }) {
  return (
    <Link href={{ pathname: '/library/[id]', params: { id: task.id } }} asChild>
      <Card>
        <View style={styles.row}>
          <ThemedText type="label" style={styles.title}>
            {task.title}
          </ThemedText>
          <ChevronRight color={Colors.neutral[700]} size={16} strokeWidth={2.75} />
        </View>

        {task.description && (
          <ThemedText type="body" color="textMuted" numberOfLines={2}>
            {task.description}
          </ThemedText>
        )}

        <View style={styles.row}>
          <View style={styles.badges}>
            {task.category && <Badge label={task.category} variant="category" />}
            {task.difficulty && <Badge label={task.difficulty} variant="difficulty" />}
          </View>
          {/* Canvas 03 marks tasks carrying a reference with a plain "Link" overline. */}
          {task.referenceLink && (
            <ThemedText type="overline" color="textMuted">
              Link
            </ThemedText>
          )}
        </View>
      </Card>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1 },
  badges: { flexDirection: 'row', gap: Spacing[2] },
});
