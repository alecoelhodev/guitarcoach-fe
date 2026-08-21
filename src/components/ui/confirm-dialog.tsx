import { Modal, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Shadow, Spacing } from '@/theme/tokens';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <ThemedText type="h5">{title}</ThemedText>
          {message && (
            <ThemedText type="body" color="textMuted" style={styles.message}>
              {message}
            </ThemedText>
          )}
          <View style={styles.actions}>
            <Button variant="ghost" onPress={onCancel} style={styles.action}>
              {cancelLabel}
            </Button>
            <Button onPress={onConfirm} style={styles.action}>
              {confirmLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(32,30,29,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[6],
    gap: Spacing[2],
    ...Shadow.lg,
  },
  message: {
    marginBottom: Spacing[2],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing[3],
  },
  action: {
    flexGrow: 0,
  },
});
