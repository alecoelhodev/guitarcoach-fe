import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDeleteAccount, useSignOut } from '@/api/auth.queries';
import { useRemoveAvatar, useUploadAvatar } from '@/api/avatar.queries';
import { describeApiTarget } from '@/api/base-url';
import { ApiError, apiTarget } from '@/api/client';
import { describeError } from '@/api/errors';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Avatar } from '@/features/profile/avatar';
import { pickAvatar } from '@/features/profile/pick-avatar';
import { useBottomInset } from '@/hooks/use-bottom-inset';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';
import { Colors, MaxContentWidth, Spacing } from '@/theme/tokens';

function photoErrorTitle(error: unknown) {
  if (error instanceof ApiError && error.status === 413) return 'That photo is too large';
  if (error instanceof ApiError && error.status === 400) return 'Use a JPEG, PNG or WebP photo';
  return describeError(error, "Couldn't update your photo").title;
}

export function ProfileScreen() {
  // Clears the tab bar and the home indicator under it.
  const bottomPad = useBottomInset() + Spacing[4];
  const user = useSessionStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const signOutMutation = useSignOut();
  const deleteAccountMutation = useDeleteAccount();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingRemovePhoto, setConfirmingRemovePhoto] = useState(false);
  const busy = signOutMutation.isPending || deleteAccountMutation.isPending;
  const photoBusy = uploadAvatar.isPending || removeAvatar.isPending;

  async function choosePhoto() {
    if (photoBusy) return;
    let file: Awaited<ReturnType<typeof pickAvatar>>;
    try {
      file = await pickAvatar();
    } catch {
      showToast("Couldn't open that photo", 'error');
      return;
    }
    if (!file) return;
    uploadAvatar.mutate(file, {
      onSuccess: () => showToast('Photo updated', 'success'),
      onError: (error) => showToast(photoErrorTitle(error), 'error'),
    });
  }

  function removePhoto() {
    setConfirmingRemovePhoto(false);
    removeAvatar.mutate(undefined, {
      onSuccess: () => showToast('Photo removed', 'success'),
      onError: (error) =>
        showToast(describeError(error, "Couldn't remove your photo").title, 'error'),
    });
  }

  function deleteAccount() {
    setConfirmingDelete(false);
    deleteAccountMutation.mutate(undefined, {
      // On success the teardown has already routed to sign-in. A failure leaves the account
      // and this session intact, so say so rather than signing out.
      onError: (error) =>
        showToast(describeError(error, "Couldn't delete your account").title, 'error'),
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { paddingBottom: bottomPad }]} edges={['top']}>
        <ThemedText type="h3">Profile</ThemedText>

        {user && (
          <>
            <Card style={styles.identity}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={user.image ? 'Change profile photo' : 'Add profile photo'}
                accessibilityState={{ busy: photoBusy }}
                onPress={() => void choosePhoto()}
              >
                <Avatar user={user} size="lg" />
              </Pressable>
              <ThemedText type="h5">{user.name}</ThemedText>
              <ThemedText type="body" color="textMuted">
                {user.email}
              </ThemedText>
              {uploadAvatar.isPending ? (
                <ThemedText type="body" color="textMuted">
                  Uploading photo…
                </ThemedText>
              ) : (
                user.image && (
                  <Button
                    variant="tertiary"
                    disabled={photoBusy}
                    onPress={() => setConfirmingRemovePhoto(true)}
                  >
                    Remove photo
                  </Button>
                )
              )}
            </Card>

            <Card>
              <DetailRow label="Display name" value={user.name} />
              <View style={styles.divider} />
              <DetailRow label="Email" value={user.email} />
              <View style={styles.divider} />
              <DetailRow
                label="Member since"
                value={new Date(user.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  year: 'numeric',
                })}
              />
              {/* Dev only — a shipped build must not name internal hosts. Without it, "No
                  connection" cannot be told apart from "pointed at the wrong backend". */}
              {__DEV__ && (
                <>
                  <View style={styles.divider} />
                  <DetailRow label="API" value={describeApiTarget(apiTarget)} />
                </>
              )}
            </Card>
          </>
        )}

        {/* Canvas styles sign-out as a secondary button in danger, not a primary action. */}
        <Button
          variant="secondary"
          className="border-danger-300"
          disabled={busy}
          onPress={() =>
            signOutMutation.mutate(undefined, {
              // The teardown runs either way, so the user is on the sign-in screen by the
              // time this fires — but the cookie is still live server-side, which is the one
              // thing they cannot see and might act on.
              onError: () =>
                showToast("Signed out here, but we couldn't reach the server", 'error'),
            })
          }
        >
          <ButtonText className="text-danger-700">
            {signOutMutation.isPending ? 'Signing out…' : 'Sign out'}
          </ButtonText>
        </Button>

        {/* Apple 5.1.1(v) and Google Play both require deletion to be reachable in-app. */}
        <Button variant="tertiary" disabled={busy} onPress={() => setConfirmingDelete(true)}>
          <ButtonText className="text-danger-700">
            {deleteAccountMutation.isPending ? 'Deleting account…' : 'Delete account'}
          </ButtonText>
        </Button>

        <ConfirmDialog
          visible={confirmingRemovePhoto}
          title="Remove your photo?"
          message="Your initials show instead."
          confirmLabel="Remove photo"
          destructive
          onConfirm={removePhoto}
          onCancel={() => setConfirmingRemovePhoto(false)}
        />

        <ConfirmDialog
          visible={confirmingDelete}
          title="Delete your account?"
          message="Your routines, practice history and recordings are permanently deleted. This can't be undone."
          confirmLabel="Delete account"
          destructive
          onConfirm={deleteAccount}
          onCancel={() => setConfirmingDelete(false)}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="body" color="textMuted">
        {label}
      </ThemedText>
      <ThemedText type="label" style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing[4],
    gap: Spacing[4],
  },
  identity: {
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.neutral[300],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[3],
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
