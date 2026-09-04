import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors } from '@/theme/tokens';
import { Typography, type TypographyRole } from '@/theme/typography';

export type ThemedTextColor = 'text' | 'textMuted' | 'accent' | 'accent2';

export type ThemedTextProps = TextProps & {
  type?: TypographyRole;
  color?: ThemedTextColor;
};

/**
 * The canvas has two real heading sizes: `h3` (21px) for screen titles and `h5` (16px)
 * for card titles. `h1`/`h2` are wider-viewport steps; `display` is the session clock.
 */
export function ThemedText({ style, type = 'body', color = 'text', ...rest }: ThemedTextProps) {
  return <Text style={[styles[type], { color: Colors[color] }, style]} {...rest} />;
}

const styles = StyleSheet.create(Typography);
