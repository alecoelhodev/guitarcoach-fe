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
}: ConfirmDialogProps) {
  return (
    <AlertDialog isOpen={visible} onClose={onCancel}>
      <AlertDialogBackdrop />
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
          <Button variant="tertiary" onPress={onCancel} className="min-h-[40px] flex-1">
            {cancelLabel}
          </Button>
          {destructive ? (
            <Button variant="tertiary" onPress={onConfirm} className="min-h-[40px] flex-1">
              <ButtonText className="text-danger-700">{confirmLabel}</ButtonText>
            </Button>
          ) : (
            <Button onPress={onConfirm} className="min-h-[40px] flex-1">
              {confirmLabel}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
