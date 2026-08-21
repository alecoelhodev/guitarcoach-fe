import { StyleSheet, View } from 'react-native';

import { Colors, Radius } from '@/theme/tokens';

export type ProgressBarProps = {
  /** 0–1 */
  progress: number;
};

export function ProgressBar({ progress }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutral[300],
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
  },
});
