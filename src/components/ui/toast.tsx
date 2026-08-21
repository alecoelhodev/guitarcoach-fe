import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Shadow, Spacing } from '@/theme/tokens';

export type ToastVariant = 'default' | 'success' | 'error';

export type ToastProps = {
  message: string;
  variant?: ToastVariant;
};

export function Toast({ message, variant = 'default' }: ToastProps) {
  return (
    <View style={[styles.base, styles[variant]]}>
      <ThemedText type="label" style={styles.text}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutral[900],
    ...Shadow.md,
  },
  default: {
    backgroundColor: Colors.neutral[900],
  },
  success: {
    backgroundColor: Colors.accent2Ramp[700],
  },
  error: {
    backgroundColor: Colors.accentRamp[800],
  },
  text: {
    color: Colors.neutral[100],
  },
});
