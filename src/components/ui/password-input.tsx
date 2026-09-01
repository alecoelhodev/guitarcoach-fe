import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Input, type InputProps } from '@/components/ui/input';
import { Spacing } from '@/theme/tokens';

/** Wireframe 01: the show/hide toggle is a 44px tap target sitting inside the field. */
const TOGGLE_WIDTH = 44;

export type PasswordInputProps = Omit<InputProps, 'secureTextEntry'>;

export const PasswordInput = forwardRef<TextInput, PasswordInputProps>(function PasswordInput(
  { style, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <Input
        ref={ref}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.field, style]}
        {...rest}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        onPress={() => setVisible((current) => !current)}
        style={styles.toggle}
      >
        <ThemedText type="label" color="accent">
          {visible ? 'Hide' : 'Show'}
        </ThemedText>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    paddingRight: TOGGLE_WIDTH + Spacing[2],
  },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: TOGGLE_WIDTH,
    minHeight: TOGGLE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
