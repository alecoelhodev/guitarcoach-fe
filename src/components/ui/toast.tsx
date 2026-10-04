import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Shadow, Spacing } from '@/theme/tokens';

export type ToastVariant = 'default' | 'success' | 'error';

export type ToastProps = {
  message: string;
  variant?: ToastVariant;
  /** Dismisses on tap. Required: without it the message owns the screen for four seconds. */
  onDismiss: () => void;
};

/**
 * Canvas `.tst`. The canvas pairs the success ground (accent2-800) with accent2-100
 * text — both near-black, about 1.1:1 — so the 700 step is used instead (~9:1).
 * `error` follows the `.pnl` danger pairing.
 */
const tone = {
  default: { backgroundColor: Colors.neutral[200], color: Colors.text },
  success: { backgroundColor: Colors.accent2Ramp[800], color: Colors.accent2Ramp[700] },
  error: { backgroundColor: Colors.dangerRamp[100], color: Colors.dangerRamp[700] },
} as const;

export function Toast({ message, variant = 'default', onDismiss }: ToastProps) {
  const { color, ...surface } = tone[variant];

  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityHint="Tap to dismiss"
      onPress={onDismiss}
      style={[styles.base, surface]}
    >
      <ThemedText type="label" style={{ color }}>
        {message}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'center',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.lg,
    ...Shadow.md,
  },
});
