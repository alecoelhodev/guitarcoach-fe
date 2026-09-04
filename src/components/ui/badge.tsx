import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type BadgeVariant = 'category' | 'difficulty' | 'neutral';

export type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
};

// The canvas pairs each ground with the 700 step of its own ramp.
const labelColor: Record<BadgeVariant, string> = {
  category: Colors.accent2Ramp[700],
  difficulty: Colors.accentRamp[700],
  neutral: Colors.neutral[700],
};

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant]]}>
      <ThemedText type="badge" style={{ color: labelColor[variant] }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[1],
    borderRadius: Radius.pill,
  },
  category: {
    backgroundColor: Colors.accent2Ramp[200],
  },
  difficulty: {
    backgroundColor: Colors.accentRamp[200],
  },
  neutral: {
    backgroundColor: Colors.neutral[200],
  },
});
