import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Shadow, Spacing } from '@/theme/tokens';

export type ToastVariant = 'default' | 'success' | 'error';

export type ToastProps = {
  message: string;
  variant?: ToastVariant;
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

export function Toast({ message, variant = 'default' }: ToastProps) {
  const { color, ...surface } = tone[variant];

  return (
    <View accessibilityRole="alert" style={[styles.base, surface]}>
      <ThemedText type="label" style={{ color }}>
        {message}
      </ThemedText>
    </View>
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
