import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';

export type StepperProps = {
  minutes: number;
  onChange: (minutes: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /**
   * Makes the floor clearable instead of dead. With it, decrementing at `min` clears the
   * value rather than doing nothing — which is how a routine task drops its target duration
   * without the stepper ever reaching 0, a value the backend rejects (`@Min(1)`).
   */
  onClear?: () => void;
};

/**
 * Canvas's minutes stepper: round 44px tertiary buttons either side of the value.
 * The round form is `Button`'s tertiary variant reshaped by className, so the
 * disabled and press states come from the one button implementation.
 */
const ROUND = 'h-[44px] w-[44px] rounded-pill px-0';

export function Stepper({
  minutes,
  onChange,
  step = 1,
  min = 0,
  max = 180,
  onClear,
}: StepperProps) {
  const atFloor = minutes <= min;

  return (
    <View style={styles.row}>
      <Button
        variant="tertiary"
        className={ROUND}
        accessibilityLabel={atFloor && onClear ? 'Clear duration' : 'Decrease minutes'}
        disabled={atFloor && !onClear}
        onPress={() => (atFloor ? onClear?.() : onChange(Math.max(min, minutes - step)))}
      >
        −
      </Button>

      <ThemedText type="label" style={styles.value}>
        {minutes} min
      </ThemedText>

      <Button
        variant="tertiary"
        className={ROUND}
        accessibilityLabel="Increase minutes"
        disabled={minutes >= max}
        onPress={() => onChange(Math.min(max, minutes + step))}
      >
        +
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    minWidth: 56,
    textAlign: 'center',
  },
});
