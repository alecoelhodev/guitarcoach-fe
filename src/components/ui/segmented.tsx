import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Canvas's pill toggle. The selected segment fills with `accent` and takes
 * neutral-100 text — dark-on-blue, which the canvas prefers to white and which
 * measures better (~4.5:1 against ~3.1:1).
 */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <ThemedText
              type="label"
              style={{ color: selected ? Colors.neutral[100] : Colors.neutral[700] }}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.neutral[400],
    borderRadius: Radius.pill,
    padding: Spacing[1],
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  segmentSelected: {
    backgroundColor: Colors.accent,
  },
});
