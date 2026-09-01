import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Interaction, Radius, Spacing } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  variant?: ButtonVariant;
  block?: boolean;
  loading?: boolean;
  /** Shown in place of the spinner while `loading`, for forms that must keep a visible label. */
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  block = false,
  loading = false,
  loadingLabel,
  disabled,
  style,
  children,
  ...rest
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const isDisabled = disabled || loading;
  const label = loading && loadingLabel ? loadingLabel : children;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPressIn={(e) => {
        setPressed(true);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        rest.onPressOut?.(e);
      }}
      onHoverIn={(e) => {
        setHovered(true);
        rest.onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        setHovered(false);
        rest.onHoverOut?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'icon' && styles.icon,
        variant === 'primary' && pressed && { backgroundColor: Interaction.primaryPressed },
        variant === 'primary' &&
          hovered &&
          !pressed && { backgroundColor: Interaction.primaryHover },
        block && styles.block,
        focused && styles.focusRing,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading && !loadingLabel ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.bg : Colors.accent} />
      ) : typeof label === 'string' ? (
        <ThemedText
          type="button"
          color={variant === 'primary' ? undefined : 'accent'}
          style={variant === 'primary' && styles.primaryLabel}
        >
          {label}
        </ThemedText>
      ) : (
        label
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderRadius: Radius.pill,
  },
  primary: {
    backgroundColor: Colors.accent,
  },
  primaryLabel: {
    color: Colors.bg,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  icon: {
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill,
  },
  block: {
    alignSelf: 'stretch',
  },
  focusRing: {
    outlineWidth: Interaction.focusRingWidth,
    outlineColor: Interaction.focusRingColor,
    outlineOffset: Interaction.focusRingOffset,
  },
  disabled: {
    opacity: Interaction.disabledOpacity,
  },
});
