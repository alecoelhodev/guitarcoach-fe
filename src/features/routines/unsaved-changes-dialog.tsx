import { ThemedText } from '@/components/themed-text';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type UnsavedChangesDialogProps = {
  visible: boolean;
  message?: string;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
};

/**
 * Canvas 06b's three-way leave prompt. `ConfirmDialog` covers the two-button shape and this is
 * the only place in the app that needs a third action, so it composes the same `AlertDialog`
 * primitives rather than growing `ConfirmDialog` a variant no other caller wants.
 *
 * The actions stack rather than sit in a row: three 40px buttons side by side do not fit the
 * 400px dialog at phone width.
 */
export function UnsavedChangesDialog({
  visible,
  message,
  saving = false,
  onSave,
  onDiscard,
  onKeepEditing,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog isOpen={visible} onClose={onKeepEditing}>
      <AlertDialogBackdrop />
      <AlertDialogContent className="w-full max-w-[400px]">
        <AlertDialogHeader>
          <ThemedText type="label">Save changes to this routine?</ThemedText>
        </AlertDialogHeader>

        {message && (
          <AlertDialogBody>
            <ThemedText type="body" color="textMuted">
              {message}
            </ThemedText>
          </AlertDialogBody>
        )}

        <AlertDialogFooter className="w-full flex-col gap-2">
          <Button block loading={saving} loadingLabel="Saving…" onPress={onSave}>
            Save
          </Button>
          <Button variant="tertiary" block disabled={saving} onPress={onDiscard}>
            Discard
          </Button>
          <Button variant="tertiary" block disabled={saving} onPress={onKeepEditing}>
            Keep editing
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
