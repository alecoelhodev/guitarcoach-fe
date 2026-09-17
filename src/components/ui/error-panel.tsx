import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type ErrorPanelProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
  /** Canvas 04b pairs Try again with a Dismiss for panels the user can simply walk away from. */
  onDismiss?: () => void;
};

export function ErrorPanel({ title, message, onRetry, onDismiss }: ErrorPanelProps) {
  return (
    <View accessibilityRole="alert" style={styles.base}>
      <ThemedText type="label" style={styles.text}>
        {title}
      </ThemedText>
      {message && (
        <ThemedText type="body" style={[styles.text, styles.message]}>
          {message}
        </ThemedText>
      )}
      {(onRetry || onDismiss) && (
        <View style={styles.actions}>
          {onRetry && (
            <Button variant="tertiary" onPress={onRetry}>
              Try again
            </Button>
          )}
          {/* Destructive-free but still last: canvas 04b orders it Try again, then Dismiss. */}
          {onDismiss && (
            <Button variant="tertiary" onPress={onDismiss}>
              Dismiss
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[3],
    borderWidth: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dangerRamp[100],
    borderColor: Colors.dangerRamp[300],
  },
  text: {
    color: Colors.dangerRamp[700],
  },
  message: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginTop: Spacing[1],
  },
});
