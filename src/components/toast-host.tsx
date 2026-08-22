import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Toast } from '@/components/ui/toast';
import { useToastStore } from '@/stores/toast-store';

const AUTO_DISMISS_MS = 3000;

export function ToastHost() {
  const toast = useToastStore((state) => state.toast);
  const hide = useToastStore((state) => state.hide);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(hide, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [toast, hide]);

  if (!toast) return null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']} pointerEvents="none">
      <Toast message={toast.message} variant={toast.variant} />
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
