import { useEffect, useState } from 'react';
import { Animated, type DimensionValue, StyleSheet } from 'react-native';

import { Colors, Radius } from '@/theme/tokens';

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
});
