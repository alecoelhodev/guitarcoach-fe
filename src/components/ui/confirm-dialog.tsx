import { useEffect } from 'react';

import { ThemedText } from '@/components/themed-text';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { Button, ButtonText } from '@/components/ui/button';
import { warned } from '@/lib/haptics';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm action in danger. Canvas 1h keeps it last in the group. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * Backdrop tap, Escape and hardware back. Defaults to `onCancel`, which is only safe when
   * cancelling does nothing. Home's resume prompt makes cancel *discard the session*, so a
   * stray backdrop tap destroyed unsaved practice — a dismiss must never be destructive.
   */
  onDismiss?: () => void;
};

/**
 * Canvas's confirmation shape: a question, a consequence line, then the actions with
 * the destructive one last (canvas 1g, 1h).
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  onDismiss,
}: ConfirmDialogProps) {
  // Only the destructive ones. A resume prompt is a question; a delete is a warning, and the
  // dialog is the last moment before something the user cannot undo.
  useEffect(() => {
    if (visible && destructive) warned();
  }, [visible, destructive]);

  return (
    <AlertDialog isOpen={visible} onClose={onDismiss ?? onCancel}>
      {/* Named so the dismiss-is-not-cancel rule has a regression test. */}
      <AlertDialogBackdrop testID="confirm-dialog-backdrop" />
      <AlertDialogContent className="w-full max-w-[400px]">
        <AlertDialogHeader>
          <ThemedText type="label">{title}</ThemedText>
        </AlertDialogHeader>

        {message && (
          <AlertDialogBody>
            <ThemedText type="body" color="textMuted">
              {message}
            </ThemedText>
          </AlertDialogBody>
        )}

        <AlertDialogFooter className="gap-2">
          <Button variant="tertiary" onPress={onCancel} className="min-h-[44px] flex-1">
            {cancelLabel}
          </Button>
          {destructive ? (
            <Button variant="tertiary" onPress={onConfirm} className="min-h-[44px] flex-1">
              <ButtonText className="text-danger-700">{confirmLabel}</ButtonText>
            </Button>
          ) : (
            <Button onPress={onConfirm} className="min-h-[44px] flex-1">
              {confirmLabel}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
