import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export type SheetProps = {
  visible: boolean;
  /** Fired when the sheet closes itself — a backdrop tap or a swipe down. */
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

/**
 * The app's bottom sheet. `BottomSheetModalProvider` is already mounted at the root
 * (`src/app/_layout.tsx`), so this only needs the modal itself.
 *
 * Driven by a `visible` prop rather than a ref the caller holds, to match `ConfirmDialog` and
 * `AlertDialog` — every overlay in this codebase is declarative, and a ref-based one would be
 * the odd one out.
 *
 * The children are gated on `visible` deliberately. `@gorhom/bottom-sheet/mock` renders its
 * children unconditionally, so without this gate a test asserting the sheet is closed would
 * pass while the content sat in the tree — the same failure mode AGENTS.md records for
 * Gluestack overlays rendered without a provider. The cost is that the closing animation plays
 * against an empty sheet; every dismissal in this app either navigates away or is the user
 * already dragging the sheet off screen, so it is not a frame anyone watches.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const modal = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) modal.current?.present();
    else modal.current?.dismiss();
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modal}
      onDismiss={onClose}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.body}>
        {visible && (
          <>
            <ThemedText type="h4">{title}</ThemedText>
            {children}
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: Colors.surface, borderRadius: Radius.sheet },
  handle: { backgroundColor: Colors.neutral[400] },
  // Bottom padding clears the home indicator; the sheet sits outside SafeAreaView.
  body: { padding: Spacing[4], paddingBottom: Spacing[8], gap: Spacing[3] },
});
