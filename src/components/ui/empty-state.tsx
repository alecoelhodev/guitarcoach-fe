import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/theme/tokens';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Canvas renders empty states as the dashed `.cd` — the same surface as `Card`'s
 * `quiet` variant. `icon` and the action are used by canvas 02c, 03b and 08b.
 */
export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Card quiet style={styles.base}>
      {icon}
      <ThemedText type="label">{title}</ThemedText>
      {message && (
        <ThemedText type="body" color="textMuted" style={styles.message}>
          {message}
        </ThemedText>
      )}
      {actionLabel && onAction && (
        <Button variant="secondary" onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    padding: Spacing[4],
  },
  message: {
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing[1],
  },
});
