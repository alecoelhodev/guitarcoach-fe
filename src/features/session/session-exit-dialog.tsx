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

export type SessionExitDialogProps = {
  visible: boolean;
  message: string;
  saving?: boolean;
  onFinish: () => void;
  onKeepPracticing: () => void;
  onDiscard: () => void;
};

/**
 * Canvas 07b's exit confirmation. Three actions, and the order is the point: a finished session
 * cannot be edited afterwards, so this is the last chance to correct the numbers — which is why
 * "Keep practicing" sits between saving and discarding rather than beside the destructive option.
 *
 * "Discard session" issues no request. Nothing partial exists on the server: the session is one
 * write, on Finish.
 *
 * Stacked rather than in a row for the same reason as `unsaved-changes-dialog` — three 40px
 * buttons do not fit a 400px dialog at phone width.
 */
export function SessionExitDialog({
  visible,
  message,
  saving = false,
  onFinish,
  onKeepPracticing,
  onDiscard,
}: SessionExitDialogProps) {
  return (
    <AlertDialog isOpen={visible} onClose={onKeepPracticing}>
      <AlertDialogBackdrop />
      <AlertDialogContent className="w-full max-w-[400px]">
        <AlertDialogHeader>
          <ThemedText type="label">Leave this session?</ThemedText>
        </AlertDialogHeader>

        <AlertDialogBody>
          <ThemedText type="body" color="textMuted">
            {message}
          </ThemedText>
        </AlertDialogBody>

        <AlertDialogFooter className="w-full flex-col gap-2">
          <Button block loading={saving} loadingLabel="Saving session…" onPress={onFinish}>
            Finish and save
          </Button>
          <Button variant="tertiary" block disabled={saving} onPress={onKeepPracticing}>
            Keep practicing
          </Button>
          <Button variant="tertiary" block disabled={saving} onPress={onDiscard}>
            <ButtonText className="text-danger-700">Discard session</ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
