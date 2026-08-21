import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type StepperProps = {
  minutes: number;
  onChange: (minutes: number) => void;
  step?: number;
  min?: number;
  max?: number;
};

export function Stepper({ minutes, onChange, step = 1, min = 0, max = 180 }: StepperProps) {
  const decrement = () => onChange(Math.max(min, minutes - step));
  const increment = () => onChange(Math.min(max, minutes + step));

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease minutes"
        disabled={minutes <= min}
        onPress={decrement}
        style={[styles.button, minutes <= min && styles.disabled]}
      >
        <ThemedText type="h5">−</ThemedText>
      </Pressable>

      <ThemedText type="h5" style={styles.value}>
        {minutes} min
      </ThemedText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase minutes"
        disabled={minutes >= max}
        onPress={increment}
        style={[styles.button, minutes >= max && styles.disabled]}
      >
        <ThemedText type="h5">+</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
  },
  disabled: {
    opacity: 0.45,
  },
  value: {
    minWidth: 64,
    textAlign: 'center',
  },
});
