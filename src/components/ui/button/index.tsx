'use client';
import { createButton } from '@gluestack-ui/core/button/creator';
import {
  tva,
  useStyleContext,
  type VariantProps,
  withStyleContext,
} from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

/**
 * Gluestack's Pressable core and style context, restyled to the canvas button set:
 * `.btnp` (primary), `.btnp.gh` (ghost), `.btns` (secondary), `.btnt` (tertiary),
 * plus the 44px round icon form.
 *
 * The canvas has no spinner state — frame 01c specifies "fields locked, button label
 * swaps, no spinner-only state" — so `loading` swaps the label and dims the ground
 * rather than rendering a spinner, and Gluestack's Spinner slot is left unused.
 */
const SCOPE = 'BUTTON';
const Root = withStyleContext(Pressable, SCOPE);
const UIButton = createButton({
  Root,
  Text,
  Group: View,
  Spinner: View,
  Icon: View,
});

const buttonStyle = tva({
  base: 'flex-row items-center justify-center gap-2 data-[disabled=true]:opacity-45 data-[focus-visible=true]:web:outline-none data-[focus-visible=true]:web:ring-2 data-[focus-visible=true]:web:ring-accent-700',
  variants: {
    variant: {
      primary:
        'min-h-[44px] rounded-md bg-accent px-[14px] data-[hover=true]:bg-accent-500 data-[active=true]:bg-accent-400',
      secondary:
        'min-h-[44px] rounded-md border-[1.5px] border-neutral-400 px-[14px] data-[hover=true]:bg-neutral-200 data-[active=true]:bg-neutral-300',
      tertiary:
        'min-h-[36px] rounded-sm border border-neutral-300 bg-neutral-200 px-[14px] data-[hover=true]:bg-neutral-300 data-[active=true]:bg-neutral-400',
      ghost:
        'min-h-[44px] rounded-md border-[1.5px] border-accent-400 px-[14px] data-[hover=true]:bg-accent-100 data-[active=true]:bg-accent-200',
      icon: 'h-[44px] w-[44px] rounded-pill data-[hover=true]:bg-neutral-200 data-[active=true]:bg-neutral-300',
    },
    // Canvas 07: "Complete Task" is the one oversized primary action.
    prominent: { true: 'min-h-[52px]' },
    block: { true: 'self-stretch' },
    // Canvas 01c: the loading ground. The canvas pairs accent-300 with accent-800
    // text at ~2.2:1, so the label below uses `text` instead — see AGENTS notes.
    loading: { true: 'bg-accent-300' },
  },
});

const buttonTextStyle = tva({
  base: 'web:select-none font-body-semibold',
  parentVariants: {
    variant: {
      primary: 'text-[14px] text-white',
      secondary: 'text-[13.5px] text-text',
      tertiary: 'text-[12px] text-neutral-700',
      ghost: 'text-[14px] text-accent-700',
      icon: 'text-[14px] text-text',
    },
    prominent: { true: 'text-[15px]' },
    loading: { true: 'text-text' },
  },
});

type IButtonProps = Omit<React.ComponentPropsWithoutRef<typeof UIButton>, 'children'> &
  VariantProps<typeof buttonStyle> & {
    /** Shown in place of the label while `loading`; the canvas never shows a bare spinner. */
    loadingLabel?: string;
    children?: React.ReactNode;
  };

const Button = React.forwardRef<React.ComponentRef<typeof UIButton>, IButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    prominent,
    block,
    loading,
    loadingLabel,
    disabled,
    children,
    ...props
  },
  ref,
) {
  const label = loading && loadingLabel ? loadingLabel : children;

  return (
    <UIButton
      ref={ref}
      {...props}
      disabled={disabled || loading}
      context={{ variant, prominent, loading }}
      className={buttonStyle({
        variant,
        prominent,
        block,
        loading,
        class: className,
      })}
    >
      {typeof label === 'string' ? <ButtonText>{label}</ButtonText> : label}
    </UIButton>
  );
});

type IButtonTextProps = React.ComponentPropsWithoutRef<typeof UIButton.Text> &
  VariantProps<typeof buttonTextStyle>;

const ButtonText = React.forwardRef<React.ComponentRef<typeof UIButton.Text>, IButtonTextProps>(
  function ButtonText({ className, ...props }, ref) {
    const {
      variant: parentVariant,
      prominent: parentProminent,
      loading: parentLoading,
    } = useStyleContext(SCOPE);

    return (
      <UIButton.Text
        ref={ref}
        {...props}
        className={buttonTextStyle({
          parentVariants: {
            variant: parentVariant,
            prominent: parentProminent,
            loading: parentLoading,
          },
          class: className,
        })}
      />
    );
  },
);

type IButtonGroupProps = React.ComponentPropsWithoutRef<typeof UIButton.Group>;

const ButtonGroup = React.forwardRef<React.ComponentRef<typeof UIButton.Group>, IButtonGroupProps>(
  function ButtonGroup({ className, ...props }, ref) {
    return <UIButton.Group ref={ref} {...props} className={className} />;
  },
);

export type { IButtonProps as ButtonProps };
export { Button, ButtonGroup, ButtonText };
