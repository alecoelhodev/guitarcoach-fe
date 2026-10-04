import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.base, selected && styles.selected]}
    >
      <ThemedText type="label" style={selected ? styles.labelSelected : styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    // 44 rather than the canvas's 32: the canvas is drawn at 318px wide, and these are the
    // library's filter controls — the most-tapped thing on the screen.
    minHeight: 44,
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.neutral[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  label: { color: Colors.neutral[700] },
  labelSelected: { color: Colors.white },
});
