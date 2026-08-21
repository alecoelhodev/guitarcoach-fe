import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type BadgeVariant = 'category' | 'difficulty' | 'neutral';

export type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
};

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant]]}>
      <ThemedText type="label" color={variant === 'neutral' ? 'textMuted' : 'text'}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3],
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
