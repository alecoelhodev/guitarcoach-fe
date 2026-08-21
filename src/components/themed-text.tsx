import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors } from '@/theme/tokens';
import { Typography, type TypographyRole } from '@/theme/typography';

export type ThemedTextColor = 'text' | 'textMuted' | 'accent' | 'accent2';

export type ThemedTextProps = TextProps & {
  type?: TypographyRole;
  color?: ThemedTextColor;
};

/**
 * Organic's type scale defaults to web/hero sizes (h1 = 42px). Phone screen titles
 * should use `type="h3"` or `type="h4"` — see plan/SETUP-PLAN.md step 5.
 */
export function ThemedText({ style, type = 'body', color = 'text', ...rest }: ThemedTextProps) {
  return <Text style={[styles[type], { color: Colors[color] }, style]} {...rest} />;
}

const styles = StyleSheet.create(Typography);
