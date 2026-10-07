import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Input, type InputProps } from '@/components/ui/input';
import { Colors, IconSize, IconStroke, Spacing, TapSlop } from '@/theme/tokens';

/** Wireframe 01 draws the word "Show"; an icon replaced it, as the word sat off the text line. */
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
        hitSlop={TapSlop}
        style={styles.toggle}
      >
        {visible ? (
          <EyeOff color={Colors.accentRamp[700]} size={IconSize.md} strokeWidth={IconStroke} />
        ) : (
          <Eye color={Colors.accentRamp[700]} size={IconSize.md} strokeWidth={IconStroke} />
        )}
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
