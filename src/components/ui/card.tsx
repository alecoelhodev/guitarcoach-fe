import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/theme/tokens';

export type CardProps = ViewProps & {
  /** Canvas `.cd.q` — dashed outline on the page ground, for notes and empty slots. */
  quiet?: boolean;
};

export function Card({ style, quiet = false, ...rest }: CardProps) {
  return <View style={[styles.base, quiet && styles.quiet, style]} {...rest} />;
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
