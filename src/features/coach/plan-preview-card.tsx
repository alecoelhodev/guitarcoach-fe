import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors, Spacing } from '@/theme/tokens';
import type { PracticePlan } from '@/types/coach';

export function PlanPreviewCard({
  plan,
  onConfirm,
  onDecline,
  loading,
}: {
  plan: PracticePlan;
  onConfirm: () => void;
  onDecline: () => void;
  loading?: boolean;
}) {
  return (
    <Card>
      <View style={styles.row}>
        <ThemedText type="overline" color="textMuted">
          Draft plan
        </ThemedText>
        {/* Canvas 10: nothing is written until Save, and the badge says so throughout. */}
        <Badge label="Not saved" />
      </View>

      <ThemedText type="h5">{plan.title}</ThemedText>
      <ThemedText type="body" color="textMuted">
        {plan.summary}
      </ThemedText>

      <View style={styles.row}>
        <ThemedText type="label">{plan.totalDurationMinutes} min total</ThemedText>
        <ThemedText type="body" color="textMuted">
          {plan.tasks.length} {plan.tasks.length === 1 ? 'task' : 'tasks'}
        </ThemedText>
      </View>

      <View style={styles.divider} />

      {plan.tasks.map((task, index) => (
        <View key={index} style={styles.taskRow}>
          <ThemedText type="body" color="textMuted" style={styles.index}>
            {index + 1}
          </ThemedText>
          <ThemedText type="label" style={styles.taskTitle} numberOfLines={2}>
            {task.title}
          </ThemedText>
          <ThemedText type="body" color="textMuted">
            {task.durationMinutes} min
          </ThemedText>
        </View>
      ))}

      <View style={styles.actions}>
        <Button style={styles.action} loading={loading} onPress={onConfirm}>
          Save Routine
        </Button>
        <Button variant="tertiary" style={styles.action} disabled={loading} onPress={onDecline}>
          Discard
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: Colors.neutral[300] },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  index: { width: 14 },
  taskTitle: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[1] },
  action: { flex: 1 },
});
