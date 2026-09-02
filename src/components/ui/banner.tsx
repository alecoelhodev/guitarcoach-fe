import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type BannerTone = 'error' | 'success';

export type BannerProps = {
  title: string;
  message?: string;
  tone?: BannerTone;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Inline status block for a form — distinct from `ErrorPanel`, which is the centered
 * full-width state a query screen renders instead of its content.
 */
export function Banner({ title, message, tone = 'error', actionLabel, onAction }: BannerProps) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.base, tone === 'success' ? styles.success : styles.error]}
    >
      <ThemedText type="h5">{title}</ThemedText>
      {message && (
        <ThemedText type="body" color="textMuted">
          {message}
        </ThemedText>
      )}
      {actionLabel && onAction && (
        <Button variant="secondary" onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'flex-start',
    gap: Spacing[1],
    padding: Spacing[4],
    borderRadius: Radius.md,
  },
  error: { backgroundColor: Colors.accentRamp[100] },
  success: { backgroundColor: Colors.accent2Ramp[100] },
  action: { marginTop: Spacing[2] },
});
