import { useEffect, useState } from 'react';
import { Animated, type DimensionValue, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: keyof typeof Radius;
};

export function Skeleton({ width = '100%', height = 11, radius = 'pill' }: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.base, { width, height, borderRadius: Radius[radius], opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.neutral[300],
  },
  list: { gap: Spacing[3] },
});

/**
 * One card's worth of placeholder. `QueryState` renders this as its default pending state and
 * `session-detail` and the routine builder render it directly — the three had the same two
 * `Skeleton` widths copied between them.
 */
export function SkeletonCard() {
  return (
    <Card>
      <Skeleton width="70%" />
      <Skeleton width="45%" />
    </Card>
  );
}

/** Canvas lists settle into rows, not a single card — three is enough to read as a list. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders, with no identity of their own
        <SkeletonCard key={index} />
      ))}
    </View>
  );
}
