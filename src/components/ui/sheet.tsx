import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, type ReactNode, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing } from '@/theme/tokens';

export type SheetProps = {
  children: ReactNode;
  snapPoints?: (string | number)[];
};

/**
 * Wraps @gorhom/bottom-sheet — peer deps declare Reanimated 4.5.1 support, but
 * smoke-test drag gestures on-device before relying on it (see plan/SETUP-PLAN.md
 * step 7). If it misbehaves, fall back to Expo Router's native modal + plain view.
 */
export const Sheet = forwardRef<BottomSheetModal, SheetProps>(function Sheet(
  { children, snapPoints: snapPointsProp },
  ref,
) {
  const snapPoints = useMemo(() => snapPointsProp ?? ['50%'], [snapPointsProp]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  handle: {
    backgroundColor: Colors.divider,
  },
  content: {
    flex: 1,
    padding: Spacing[4],
  },
});
