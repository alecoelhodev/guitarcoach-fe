import { Pressable, type PressableProps, StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/theme/tokens';

export type CardProps = ViewProps & {
  /** Canvas `.cd.q` — dashed outline on the page ground, for notes and empty slots. */
  quiet?: boolean;
  /**
   * Makes the whole card the tappable region. Present so a card can be the child of a
   * `<Link asChild>`: expo-router forwards `onPress` to that child, and a plain `View`
   * accepts no such prop, so the tap is silently dropped on native while react-native-web's
   * `View` still honours the injected DOM handler — which is how a card can navigate in the
   * browser and do nothing in Expo Go. See AGENTS.md.
   */
  onPress?: PressableProps['onPress'];
};

export function Card({ style, quiet = false, onPress, ...rest }: CardProps) {
  const cardStyle = [styles.base, quiet && styles.quiet, style];

  if (onPress) return <Pressable style={cardStyle} onPress={onPress} {...rest} />;

  return <View style={cardStyle} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: Radius.xl,
    padding: Spacing[3],
    gap: Spacing[2],
  },
  quiet: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
});
