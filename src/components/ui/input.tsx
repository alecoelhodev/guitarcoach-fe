import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Colors, Interaction, Radius, Spacing } from '@/theme/tokens';
import { Typography } from '@/theme/typography';

export type InputProps = TextInputProps & {
  invalid?: boolean;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { style, invalid = false, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={Colors.textMuted}
      style={[styles.base, focused && styles.focused, invalid && styles.invalid, style]}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  base: {
    ...Typography.input,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
  },
  focused: {
    outlineWidth: Interaction.focusRingWidth,
    outlineColor: Interaction.focusRingColor,
    outlineOffset: Interaction.focusRingOffset,
    borderColor: Colors.accent,
  },
  invalid: {
    borderColor: Colors.accentRamp[700],
  },
});
