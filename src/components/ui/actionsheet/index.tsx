'use client';
import React from 'react';
import { H4 } from '@expo/html-elements';
import { createActionsheet } from '@gluestack-ui/core/actionsheet/creator';
import {
  Pressable,
  View,
  Text,
  ScrollView,
  VirtualizedList,
  FlatList,
  SectionList,
  PressableProps,
  ViewStyle,
} from 'react-native';
import { tva } from '@gluestack-ui/utils/nativewind-utils';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { cssInterop } from 'nativewind';
import {
  Motion,
  AnimatePresence,
  createMotionAnimatedComponent,
  MotionComponentProps,
} from '@legendapp/motion';

const ItemWrapper = React.forwardRef<React.ComponentRef<typeof Pressable>, PressableProps>(
  function ItemWrapper({ ...props }, ref) {
    return <Pressable {...props} ref={ref} />;
  },
);

type IMotionViewProps = React.ComponentProps<typeof View> &
  MotionComponentProps<typeof View, ViewStyle, unknown, unknown, unknown>;

const MotionView = Motion.View as React.ComponentType<IMotionViewProps>;

type IAnimatedPressableProps = React.ComponentProps<typeof Pressable> &
  MotionComponentProps<typeof Pressable, ViewStyle, unknown, unknown, unknown>;

const AnimatedPressable = createMotionAnimatedComponent(
  Pressable,
) as React.ComponentType<IAnimatedPressableProps>;

export const UIActionsheet = createActionsheet({
  Root: View,
  Content: MotionView,
  Item: ItemWrapper,
  ItemText: Text,
  DragIndicator: View,
  IndicatorWrapper: View,
  Backdrop: AnimatedPressable,
  ScrollView: ScrollView,
  VirtualizedList: VirtualizedList,
  FlatList: FlatList,
  SectionList: SectionList,
  SectionHeaderText: H4,
  Icon: View,
  AnimatePresence: AnimatePresence,
});

cssInterop(UIActionsheet, { className: 'style' });
cssInterop(UIActionsheet.Content, { className: 'style' });
cssInterop(UIActionsheet.Item, { className: 'style' });
cssInterop(UIActionsheet.ItemText, { className: 'style' });
cssInterop(UIActionsheet.DragIndicator, { className: 'style' });
cssInterop(UIActionsheet.DragIndicatorWrapper, { className: 'style' });
cssInterop(UIActionsheet.Backdrop, { className: 'style' });
cssInterop(UIActionsheet.ScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
  indicatorClassName: 'indicatorStyle',
});
cssInterop(UIActionsheet.VirtualizedList, {
  className: 'style',
  ListFooterComponentClassName: 'ListFooterComponentStyle',
  ListHeaderComponentClassName: 'ListHeaderComponentStyle',
  contentContainerClassName: 'contentContainerStyle',
  indicatorClassName: 'indicatorStyle',
});
cssInterop(UIActionsheet.FlatList, {
  className: 'style',
  ListFooterComponentClassName: 'ListFooterComponentStyle',
  ListHeaderComponentClassName: 'ListHeaderComponentStyle',
  columnWrapperClassName: 'columnWrapperStyle',
  contentContainerClassName: 'contentContainerStyle',
  indicatorClassName: 'indicatorStyle',
});
cssInterop(UIActionsheet.SectionList, { className: 'style' });
cssInterop(UIActionsheet.SectionHeaderText, { className: 'style' });

const actionsheetStyle = tva({ base: 'w-full h-full web:pointer-events-none' });

const actionsheetContentStyle = tva({
  base: 'items-center gap-2 rounded-t-sheet p-3 bg-neutral-100 web:pointer-events-auto web:select-none border-t border-neutral-300 max-h-[80vh] pb-safe',
});

const actionsheetItemStyle = tva({
  base: 'w-full flex-row items-center p-3 rounded-sm data-[disabled=true]:opacity-40 data-[disabled=true]:web:pointer-events-auto data-[disabled=true]:web:cursor-not-allowed data-[hover=true]:bg-neutral-200 data-[active=true]:bg-neutral-300 data-[focus=true]:bg-neutral-200 web:data-[focus-visible=true]:bg-neutral-200 gap-2',
});

const actionsheetItemTextStyle = tva({
  base: 'text-text font-body-semibold text-[12.5px]',
  variants: {
    isTruncated: {
      true: '',
    },
    bold: {
      true: 'font-bold',
    },
    underline: {
      true: 'underline',
    },
    strikeThrough: {
      true: 'line-through',
    },
  },
});

const actionsheetDragIndicatorStyle = tva({
  base: 'w-[38px] h-[4px] bg-neutral-400 rounded-pill',
});

const actionsheetDragIndicatorWrapperStyle = tva({
  base: 'w-full py-1 items-center',
});

const actionsheetBackdropStyle = tva({
  base: 'absolute left-0 top-0 right-0 bottom-0 bg-black/60 web:cursor-default web:pointer-events-auto',
});

const actionsheetScrollViewStyle = tva({
  base: 'w-full h-auto',
});

const actionsheetVirtualizedListStyle = tva({
  base: 'w-full h-auto',
});

const actionsheetFlatListStyle = tva({
  base: 'w-full h-auto',
});

const actionsheetSectionListStyle = tva({
  base: 'w-full h-auto',
});

const actionsheetSectionHeaderTextStyle = tva({
  base: 'font-body-semibold my-0 text-neutral-700 p-3 uppercase text-[9.5px] tracking-[0.07em]',
  variants: {
    isTruncated: {
      true: '',
    },
    bold: {
      true: 'font-bold',
    },
    underline: {
      true: 'underline',
    },
    strikeThrough: {
      true: 'line-through',
    },
    sub: {
      true: 'text-xs',
    },
    italic: {
      true: 'italic',
    },
    highlight: {
      true: 'bg-yellow-500',
    },
  },
});

type IActionsheetProps = VariantProps<typeof actionsheetStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet>;

type IActionsheetContentProps = VariantProps<typeof actionsheetContentStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.Content> & {
    className?: string;
  };

type IActionsheetItemProps = VariantProps<typeof actionsheetItemStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.Item>;

type IActionsheetItemTextProps = VariantProps<typeof actionsheetItemTextStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.ItemText>;

type IActionsheetDragIndicatorProps = VariantProps<typeof actionsheetDragIndicatorStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.DragIndicator>;

type IActionsheetDragIndicatorWrapperProps = VariantProps<
  typeof actionsheetDragIndicatorWrapperStyle
> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.DragIndicatorWrapper>;

type IActionsheetBackdropProps = VariantProps<typeof actionsheetBackdropStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.Backdrop> & {
    className?: string;
  };

type IActionsheetScrollViewProps = VariantProps<typeof actionsheetScrollViewStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.ScrollView>;

type IActionsheetVirtualizedListProps = VariantProps<typeof actionsheetVirtualizedListStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.VirtualizedList>;

type IActionsheetFlatListProps = VariantProps<typeof actionsheetFlatListStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.FlatList>;

type IActionsheetSectionListProps = VariantProps<typeof actionsheetSectionListStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.SectionList>;

type IActionsheetSectionHeaderTextProps = VariantProps<typeof actionsheetSectionHeaderTextStyle> &
  React.ComponentPropsWithoutRef<typeof UIActionsheet.SectionHeaderText>;

const Actionsheet = React.forwardRef<React.ComponentRef<typeof UIActionsheet>, IActionsheetProps>(
  function Actionsheet({ className, ...props }, ref) {
    return (
      <UIActionsheet
        className={actionsheetStyle({
          class: className,
        })}
        ref={ref}
        {...props}
      />
    );
  },
);

const ActionsheetContent = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.Content>,
  IActionsheetContentProps
>(function ActionsheetContent({ className, ...props }, ref) {
  return (
    <UIActionsheet.Content
      className={actionsheetContentStyle({
        class: className,
      })}
      ref={ref}
      {...props}
    />
  );
});

const ActionsheetItem = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.Item>,
  IActionsheetItemProps
>(function ActionsheetItem({ className, ...props }, ref) {
  return (
    <UIActionsheet.Item
      className={actionsheetItemStyle({
        class: className,
      })}
      ref={ref}
      {...props}
    />
  );
});

const ActionsheetItemText = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.ItemText>,
  IActionsheetItemTextProps
>(function ActionsheetItemText(
  { isTruncated, bold, underline, strikeThrough, className, ...props },
  ref,
) {
  return (
    <UIActionsheet.ItemText
      className={actionsheetItemTextStyle({
        class: className,
        isTruncated: Boolean(isTruncated),
        bold: Boolean(bold),
        underline: Boolean(underline),
        strikeThrough: Boolean(strikeThrough),
      })}
      ref={ref}
      {...props}
    />
  );
});

const ActionsheetDragIndicator = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.DragIndicator>,
  IActionsheetDragIndicatorProps
>(function ActionsheetDragIndicator({ className, ...props }, ref) {
  return (
    <UIActionsheet.DragIndicator
      className={actionsheetDragIndicatorStyle({
        class: className,
      })}
      ref={ref}
      {...props}
    />
  );
});

const ActionsheetDragIndicatorWrapper = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.DragIndicatorWrapper>,
  IActionsheetDragIndicatorWrapperProps
>(function ActionsheetDragIndicatorWrapper({ className, ...props }, ref) {
  return (
    <UIActionsheet.DragIndicatorWrapper
      className={actionsheetDragIndicatorWrapperStyle({
        class: className,
      })}
      ref={ref}
      {...props}
    />
  );
});

const ActionsheetBackdrop = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.Backdrop>,
  IActionsheetBackdropProps
>(function ActionsheetBackdrop({ className, ...props }, ref) {
  return (
    <UIActionsheet.Backdrop
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      transition={{
        type: 'timing',
        duration: 200,
      }}
      {...props}
      className={actionsheetBackdropStyle({
        class: className,
      })}
      ref={ref}
    />
  );
});

const ActionsheetScrollView = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.ScrollView>,
  IActionsheetScrollViewProps
>(function ActionsheetScrollView({ className, ...props }, ref) {
  return (
    <UIActionsheet.ScrollView
      className={actionsheetScrollViewStyle({
        class: className,
      })}
      ref={ref}
      {...props}
    />
  );
});

const ActionsheetVirtualizedList = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.VirtualizedList>,
  IActionsheetVirtualizedListProps
>(function ActionsheetVirtualizedList({ className, ...props }, ref) {
  return (
    <UIActionsheet.VirtualizedList
      className={actionsheetVirtualizedListStyle({
        class: className,
      })}
      ref={ref}
      {...props}
    />
  );
});

const ActionsheetFlatList = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.FlatList>,
  IActionsheetFlatListProps
>(function ActionsheetFlatList({ className, ...props }, ref) {
  return (
    <UIActionsheet.FlatList
      className={actionsheetFlatListStyle({
        class: className,
      })}
      ref={ref}
      {...props}
    />
  );
});

const ActionsheetSectionList = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.SectionList>,
  IActionsheetSectionListProps
>(function ActionsheetSectionList({ className, ...props }, ref) {
  return (
    <UIActionsheet.SectionList
      className={actionsheetSectionListStyle({
        class: className,
      })}
      ref={ref}
      {...props}
    />
  );
});

const ActionsheetSectionHeaderText = React.forwardRef<
  React.ComponentRef<typeof UIActionsheet.SectionHeaderText>,
  IActionsheetSectionHeaderTextProps
>(function ActionsheetSectionHeaderText(
  { className, isTruncated, bold, underline, strikeThrough, sub, italic, highlight, ...props },
  ref,
) {
  return (
    <UIActionsheet.SectionHeaderText
      className={actionsheetSectionHeaderTextStyle({
        class: className,
        isTruncated: Boolean(isTruncated),
        bold: Boolean(bold),
        underline: Boolean(underline),
        strikeThrough: Boolean(strikeThrough),
        sub: Boolean(sub),
        italic: Boolean(italic),
        highlight: Boolean(highlight),
      })}
      ref={ref}
      {...props}
    />
  );
});

export {
  Actionsheet,
  ActionsheetContent,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetBackdrop,
  ActionsheetScrollView,
  ActionsheetVirtualizedList,
  ActionsheetFlatList,
  ActionsheetSectionList,
  ActionsheetSectionHeaderText,
};
