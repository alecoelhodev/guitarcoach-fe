import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Toast } from '@/components/ui/toast';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { useToastStore } from '@/stores/toast-store';
import { Spacing } from '@/theme/tokens';

const AUTO_DISMISS_MS = 4000;

export function ToastHost() {
  // Canvas 04b sits the toast above the tab bar, not flush to the safe-area edge.
  const bottomInset = useBottomInset();
  const toast = useToastStore((state) => state.toast);
  const hide = useToastStore((state) => state.hide);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(hide, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [toast, hide]);

  if (!toast) return null;

  return (
    <SafeAreaView
      style={[styles.container, { paddingBottom: bottomInset + Spacing[3] }]}
      edges={['bottom']}
      // `box-none` rather than `none`: the container must stay transparent to taps so it
      // does not block the screen underneath, but the toast itself has to receive them or
      // it cannot be dismissed before its four seconds are up.
      pointerEvents="box-none"
    >
      {/* It used to appear and vanish as a hard cut, which reads as a glitch at the edge of
          vision rather than as a message. */}
      <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(140)}>
        <Toast message={toast.message} variant={toast.variant} onDismiss={hide} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
