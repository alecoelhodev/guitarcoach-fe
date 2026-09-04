'use client';
import React from 'react';
import { createCheckbox } from '@gluestack-ui/core/checkbox/creator';
import { tva, withStyleContext, type VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { View, Pressable, Text, Platform } from 'react-native';
import type { TextProps, ViewProps } from 'react-native';

const IndicatorWrapper = React.forwardRef<React.ComponentRef<typeof View>, ViewProps>(
  function IndicatorWrapper({ ...props }, ref) {
    return <View {...props} ref={ref} />;
  },
);

const LabelWrapper = React.forwardRef<React.ComponentRef<typeof Text>, TextProps>(
  function LabelWrapper({ ...props }, ref) {
    return <Text {...props} ref={ref} />;
  },
);

const SCOPE = 'CHECKBOX';
const UICheckbox = createCheckbox({
  // @ts-expect-error : internal implementation for r-19/react-native-web
  Root: Platform.OS === 'web' ? withStyleContext(View, SCOPE) : withStyleContext(Pressable, SCOPE),
  Group: View,
  Icon: View,
  Label: LabelWrapper,
  Indicator: IndicatorWrapper,
});

const checkboxStyle = tva({
  base: 'group/checkbox flex-row items-center justify-start gap-2 web:cursor-pointer data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50',
});

const checkboxIndicatorStyle = tva({
  base: 'justify-center items-center w-[20px] h-[20px] shrink-0 rounded-xs border-[1.5px] border-neutral-400 web:outline-none web:data-[focus-visible=true]:ring-2 web:data-[focus-visible=true]:ring-accent-700 data-[checked=true]:bg-accent2 data-[checked=true]:border-accent2 data-[invalid=true]:border-danger data-[disabled=true]:opacity-45',
});

const checkboxLabelStyle = tva({
  base: 'text-text text-[12.5px] font-body-semibold web:select-none web:cursor-pointer data-[disabled=true]:opacity-45',
});

const CheckboxGroup = UICheckbox.Group;

type ICheckboxProps = React.ComponentPropsWithoutRef<typeof UICheckbox> &
  VariantProps<typeof checkboxStyle>;

const Checkbox = React.forwardRef<React.ComponentRef<typeof UICheckbox>, ICheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <UICheckbox
        className={checkboxStyle({ class: className })}
        {...props}
        context={{}}
        ref={ref}
      />
    );
  },
);

type ICheckboxIndicatorProps = React.ComponentPropsWithoutRef<typeof UICheckbox.Indicator> &
  VariantProps<typeof checkboxIndicatorStyle>;

const CheckboxIndicator = React.forwardRef<
  React.ComponentRef<typeof UICheckbox.Indicator>,
  ICheckboxIndicatorProps
>(function CheckboxIndicator({ className, ...props }, ref) {
  return (
    <UICheckbox.Indicator
      className={checkboxIndicatorStyle({ class: className })}
      {...props}
      ref={ref}
    />
  );
});

type ICheckboxLabelProps = React.ComponentPropsWithoutRef<typeof UICheckbox.Label> &
  VariantProps<typeof checkboxLabelStyle>;
const CheckboxLabel = React.forwardRef<
  React.ComponentRef<typeof UICheckbox.Label>,
  ICheckboxLabelProps
>(function CheckboxLabel({ className, ...props }, ref) {
  return (
    <UICheckbox.Label className={checkboxLabelStyle({ class: className })} {...props} ref={ref} />
  );
});

Checkbox.displayName = 'Checkbox';
CheckboxIndicator.displayName = 'CheckboxIndicator';
CheckboxLabel.displayName = 'CheckboxLabel';

export { Checkbox, CheckboxIndicator, CheckboxLabel, CheckboxGroup };
