import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type BannerTone = 'error' | 'success' | 'info';

export type BannerProps = {
  title: string;
  message?: string;
  tone?: BannerTone;
  actionLabel?: string;
  onAction?: () => void;
};

// Canvas `.pnl` tints ground, border and *both* text lines from one ramp.
const tone = {
  error: {
    backgroundColor: Colors.dangerRamp[100],
    borderColor: Colors.dangerRamp[300],
    color: Colors.dangerRamp[700],
  },
  info: {
    backgroundColor: Colors.accentRamp[100],
    borderColor: Colors.accentRamp[300],
    color: Colors.accentRamp[700],
  },
  success: {
    backgroundColor: Colors.accent2Ramp[100],
    borderColor: Colors.accent2Ramp[200],
    color: Colors.accent2Ramp[700],
  },
} as const;

/**
 * Inline status block for a form — distinct from `ErrorPanel`, which is the centered
 * full-width state a query screen renders instead of its content.
 */
export function Banner({
  title,
  message,
  tone: toneName = 'error',
  actionLabel,
  onAction,
}: BannerProps) {
  const { color, ...surface } = tone[toneName];

  return (
    <View accessibilityRole="alert" style={[styles.base, surface]}>
      <ThemedText type="label" style={{ color }}>
        {title}
      </ThemedText>
      {message && (
        <ThemedText type="body" style={{ color }}>
          {message}
        </ThemedText>
      )}
      {actionLabel && onAction && (
        <Button variant="tertiary" onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'flex-start',
    gap: Spacing[2],
    padding: Spacing[3],
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  action: { marginTop: Spacing[1] },
});
