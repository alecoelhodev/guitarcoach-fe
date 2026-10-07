import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/theme/tokens';
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
      placeholderTextColor={Colors.neutral[600]}
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
    minHeight: 44,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.neutral[400],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    // Canvas 01 marks focus with the border alone; this suppresses the browser's own ring on web.
    outlineWidth: 0,
  },
  focused: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    backgroundColor: Colors.neutral[100],
  },
  invalid: {
    borderWidth: 1.5,
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerRamp[100],
  },
});
