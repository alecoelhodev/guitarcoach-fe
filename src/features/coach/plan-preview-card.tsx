import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/theme/tokens';
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
    <Card style={styles.card}>
      <ThemedText type="h5">{plan.title}</ThemedText>
      <ThemedText type="body" color="textMuted">
        {plan.summary}
      </ThemedText>
      <ThemedText type="caption" color="textMuted">
        {plan.totalDurationMinutes} min total
      </ThemedText>

      <View style={styles.tasks}>
        {plan.tasks.map((task, index) => (
          <View key={index} style={styles.taskRow}>
            <ThemedText type="body" style={{ flex: 1 }}>
              {task.title}
            </ThemedText>
            <ThemedText type="caption" color="textMuted">
              {task.durationMinutes} min
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button variant="ghost" onPress={onDecline} disabled={loading}>
          Decline
        </Button>
        <Button onPress={onConfirm} loading={loading}>
          Confirm
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing[3] },
  tasks: { gap: Spacing[2] },
  taskRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing[3] },
});
