import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/theme/tokens';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.base}>
      {icon}
      <ThemedText type="h5">{title}</ThemedText>
      {message && (
        <ThemedText type="body" color="textMuted" style={styles.message}>
          {message}
        </ThemedText>
      )}
      {actionLabel && onAction && (
        <Button onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[8],
  },
  message: {
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing[3],
  },
});
