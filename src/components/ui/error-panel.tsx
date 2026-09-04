import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type ErrorPanelProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorPanel({ title, message, onRetry }: ErrorPanelProps) {
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
      {onRetry && (
        <Button variant="tertiary" onPress={onRetry} style={styles.retry}>
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
  retry: {
    marginTop: Spacing[1],
  },
});
