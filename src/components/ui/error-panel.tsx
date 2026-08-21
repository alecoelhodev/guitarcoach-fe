import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type ErrorPanelProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorPanel({ title, message, onRetry }: ErrorPanelProps) {
  return (
    <View style={styles.base}>
      <ThemedText type="h5">{title}</ThemedText>
      {message && (
        <ThemedText type="body" color="textMuted" style={styles.message}>
          {message}
        </ThemedText>
      )}
      {onRetry && (
        <Button variant="secondary" onPress={onRetry} style={styles.retry}>
          Try again
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[6],
    borderRadius: Radius.md,
    backgroundColor: Colors.accentRamp[100],
  },
  message: {
    textAlign: 'center',
  },
  retry: {
    marginTop: Spacing[2],
  },
});
