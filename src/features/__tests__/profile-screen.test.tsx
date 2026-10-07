jest.mock('@/api/auth.queries', () => ({ useSignOut: jest.fn(), useDeleteAccount: jest.fn() }));
jest.mock('@/api/avatar.queries', () => ({
  useAvatarUrl: jest.fn(() => ({ data: undefined })),
  useUploadAvatar: jest.fn(),
  useRemoveAvatar: jest.fn(),
}));
// The picker and manipulator are native; the screen only needs what the picker resolves.
jest.mock('@/features/profile/pick-avatar', () => ({ pickAvatar: jest.fn() }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useDeleteAccount, useSignOut } from '@/api/auth.queries';
import { useRemoveAvatar, useUploadAvatar } from '@/api/avatar.queries';
import { ApiError } from '@/api/client';
import { pickAvatar } from '@/features/profile/pick-avatar';
import { ProfileScreen } from '@/features/profile/profile-screen';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';
import { asShippedBuild } from '@/test/dev-flag';
import { makeUser } from '@/test/fixtures';
import { withGluestack } from '@/test/gluestack';
import { mutationStub } from '@/test/query-hooks';

const useSignOutMock = useSignOut as unknown as jest.MockedFunction<(...args: never[]) => unknown>;
const useDeleteAccountMock = useDeleteAccount as unknown as jest.MockedFunction<
  (...args: never[]) => unknown
>;

const useUploadAvatarMock = useUploadAvatar as unknown as jest.MockedFunction<
  (...args: never[]) => unknown
>;
const useRemoveAvatarMock = useRemoveAvatar as unknown as jest.MockedFunction<
  (...args: never[]) => unknown
>;
const pickAvatarMock = pickAvatar as jest.MockedFunction<typeof pickAvatar>;

function signedIn(user = makeUser()) {
  useSessionStore.setState({ status: 'authenticated', user });
}

beforeEach(() => {
  jest.clearAllMocks();
  useSignOutMock.mockReturnValue(mutationStub());
  useDeleteAccountMock.mockReturnValue(mutationStub());
  useUploadAvatarMock.mockReturnValue(mutationStub());
  useRemoveAvatarMock.mockReturnValue(mutationStub());
});

describe('ProfileScreen', () => {
  it('shows only the heading and sign-out when there is no cached user', async () => {
    await render(<ProfileScreen />);

    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Sign out')).toBeTruthy();
    expect(screen.queryByText('Display name')).toBeNull();
  });

  it('shows the identity card and the detail rows for a signed-in user', async () => {
    signedIn(makeUser({ name: 'Jordan Lee', email: 'jordan@example.com' }));
    await render(<ProfileScreen />);

    // Name and email each appear twice — identity card and detail row.
    expect(screen.getAllByText('Jordan Lee')).toHaveLength(2);
    expect(screen.getByText('Display name')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Member since')).toBeTruthy();
    expect(screen.getAllByText('jordan@example.com')).toHaveLength(2);
  });

  it('builds the avatar from the first letter of the first two words', async () => {
    signedIn(makeUser({ name: 'Jordan Lee' }));
    await render(<ProfileScreen />);

    expect(screen.getByText('JL')).toBeTruthy();
  });

  it('uses a single initial for a one-word name', async () => {
    signedIn(makeUser({ name: 'Jordan' }));
    await render(<ProfileScreen />);

    expect(screen.getByText('J')).toBeTruthy();
  });

  it('ignores extra spaces rather than emitting blank initials', async () => {
    signedIn(makeUser({ name: '  Jordan   Lee  ' }));
    await render(<ProfileScreen />);

    expect(screen.getByText('JL')).toBeTruthy();
  });

  it('takes only the first two initials of a longer name', async () => {
    signedIn(makeUser({ name: 'Ada Grace Byron Lovelace' }));
    await render(<ProfileScreen />);

    expect(screen.getByText('AG')).toBeTruthy();
  });

  it('renders an empty avatar rather than crashing on an empty name', async () => {
    signedIn(makeUser({ name: '' }));
    await render(<ProfileScreen />);

    // The name is rendered in three places and all are empty; the screen must still mount.
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Display name')).toBeTruthy();
  });

  it('signs out on press', async () => {
    const mutation = mutationStub();
    useSignOutMock.mockReturnValue(mutation);
    await render(<ProfileScreen />);

    await fireEvent.press(screen.getByText('Sign out'));

    expect(mutation.mutate).toHaveBeenCalledTimes(1);
  });

  it('says so and blocks a second press while signing out', async () => {
    const mutation = { ...mutationStub(), isPending: true };
    useSignOutMock.mockReturnValue(mutation);
    await render(<ProfileScreen />);

    expect(screen.getByText('Signing out…')).toBeTruthy();
    expect(screen.queryByText('Sign out')).toBeNull();

    await fireEvent.press(screen.getByText('Signing out…'));

    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  /**
   * The point of the row: "No connection" is the same message whether the network is down or the
   * app is pointed at a backend that cannot answer it, so the screen has to say which one it
   * chose. It is `__DEV__`-only because a shipped build must not name internal hosts.
   */
  it('shows which backend it is talking to, in dev only', async () => {
    signedIn();
    await render(<ProfileScreen />);

    expect(screen.getByText('API')).toBeTruthy();
    expect(screen.getByText('localhost:3000')).toBeTruthy();
  });

  it('hides the backend row outside dev', async () => {
    signedIn();

    await asShippedBuild(async () => {
      await render(<ProfileScreen />);
      expect(screen.queryByText('API')).toBeNull();
    });
  });

  it('formats "member since" as a month and year', async () => {
    signedIn(makeUser({ createdAt: '2026-03-15T00:00:00.000Z' }));
    await render(<ProfileScreen />);

    // Matched loosely on purpose: `toLocaleDateString(undefined, …)` follows Node's default
    // locale, which differs between a laptop and CI's ICU build. The TZ pin in
    // `jest.config.js` fixes the zone but not the locale.
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  describe('account deletion', () => {
    it('asks before deleting, and cancelling deletes nothing', async () => {
      const mutation = mutationStub();
      useDeleteAccountMock.mockReturnValue(mutation);
      signedIn();
      await render(withGluestack(<ProfileScreen />));

      await fireEvent.press(screen.getByText('Delete account'));
      expect(screen.getByText('Delete your account?')).toBeTruthy();

      await fireEvent.press(screen.getByText('Cancel'));

      expect(mutation.mutate).not.toHaveBeenCalled();
      expect(screen.queryByText('Delete your account?')).toBeNull();
    });

    it('deletes once confirmed', async () => {
      const mutation = mutationStub();
      useDeleteAccountMock.mockReturnValue(mutation);
      signedIn();
      await render(withGluestack(<ProfileScreen />));

      await fireEvent.press(screen.getByText('Delete account'));
      // The dialog's confirm repeats the label; the trigger is the first match.
      const [, confirm] = screen.getAllByText('Delete account');
      await fireEvent.press(confirm);

      expect(mutation.mutate).toHaveBeenCalledTimes(1);
    });

    it('stays signed in and says why when the delete fails', async () => {
      const mutation = mutationStub();
      mutation.mutate.mockImplementation((_vars, options?: { onError?: (e: unknown) => void }) =>
        options?.onError?.(new ApiError('down', 503)),
      );
      useDeleteAccountMock.mockReturnValue(mutation);
      signedIn();
      await render(withGluestack(<ProfileScreen />));

      await fireEvent.press(screen.getByText('Delete account'));
      await fireEvent.press(screen.getAllByText('Delete account')[1]);

      expect(useToastStore.getState().toast).toMatchObject({
        message: 'Something went wrong on our end',
        variant: 'error',
      });
      expect(useSessionStore.getState().status).toBe('authenticated');
    });

    it('blocks both account actions while deleting', async () => {
      const deleting = { ...mutationStub(), isPending: true };
      const signOut = mutationStub();
      useDeleteAccountMock.mockReturnValue(deleting);
      useSignOutMock.mockReturnValue(signOut);
      await render(withGluestack(<ProfileScreen />));

      expect(screen.getByText('Deleting account…')).toBeTruthy();
      await fireEvent.press(screen.getByText('Sign out'));
      await fireEvent.press(screen.getByText('Deleting account…'));

      expect(signOut.mutate).not.toHaveBeenCalled();
      expect(screen.queryByText('Delete your account?')).toBeNull();
    });
  });

  describe('profile photo', () => {
    const FILE = { uri: 'file:///avatar.jpg', name: 'avatar.jpg', mimeType: 'image/jpeg' };

    function failWith(mutation: ReturnType<typeof mutationStub>, error: unknown) {
      mutation.mutate.mockImplementation((_vars, options?: { onError?: (e: unknown) => void }) =>
        options?.onError?.(error),
      );
    }

    it('uploads the picked photo from the avatar, and says so', async () => {
      const upload = mutationStub();
      upload.mutate.mockImplementation((_vars, options?: { onSuccess?: () => void }) =>
        options?.onSuccess?.(),
      );
      useUploadAvatarMock.mockReturnValue(upload);
      pickAvatarMock.mockResolvedValue(FILE);
      signedIn();
      await render(<ProfileScreen />);

      await fireEvent.press(screen.getByLabelText('Add profile photo'));

      expect(upload.mutate).toHaveBeenCalledWith(FILE, expect.anything());
      expect(useToastStore.getState().toast).toMatchObject({
        message: 'Photo updated',
        variant: 'success',
      });
    });

    it('shows that the chosen photo is being prepared', async () => {
      let finish: (file: typeof FILE) => void = () => {};
      pickAvatarMock.mockImplementation((onPicked) => {
        onPicked?.();
        return new Promise((resolve) => {
          finish = resolve;
        });
      });
      const upload = mutationStub();
      useUploadAvatarMock.mockReturnValue(upload);
      signedIn();
      await render(<ProfileScreen />);

      await fireEvent.press(screen.getByLabelText('Add profile photo'));
      expect(screen.getByText('Preparing photo…')).toBeTruthy();

      await act(async () => finish(FILE));
      expect(screen.queryByText('Preparing photo…')).toBeNull();
      expect(upload.mutate).toHaveBeenCalledWith(FILE, expect.anything());
    });

    it('does nothing when the picker is cancelled', async () => {
      const upload = mutationStub();
      useUploadAvatarMock.mockReturnValue(upload);
      pickAvatarMock.mockResolvedValue(null);
      signedIn();
      await render(<ProfileScreen />);

      await fireEvent.press(screen.getByLabelText('Add profile photo'));

      expect(upload.mutate).not.toHaveBeenCalled();
    });

    it('says so when the photo cannot be read', async () => {
      pickAvatarMock.mockRejectedValue(new Error('decode failed'));
      signedIn();
      await render(<ProfileScreen />);

      await fireEvent.press(screen.getByLabelText('Add profile photo'));

      expect(useToastStore.getState().toast).toMatchObject({
        message: "Couldn't open that photo",
        variant: 'error',
      });
    });

    it.each([
      [413, 'That photo is too large'],
      [400, 'Use a JPEG, PNG or WebP photo'],
    ])('names a %i rejection', async (status, message) => {
      const upload = mutationStub();
      failWith(upload, new ApiError('rejected', status));
      useUploadAvatarMock.mockReturnValue(upload);
      pickAvatarMock.mockResolvedValue(FILE);
      signedIn();
      await render(<ProfileScreen />);

      await fireEvent.press(screen.getByLabelText('Add profile photo'));

      expect(useToastStore.getState().toast).toMatchObject({ message, variant: 'error' });
    });

    it('offers Remove only when a photo is set, and asks first', async () => {
      const remove = mutationStub();
      useRemoveAvatarMock.mockReturnValue(remove);
      signedIn(makeUser({ image: 'users/u1/avatar/a.jpg' }));
      await render(withGluestack(<ProfileScreen />));

      expect(screen.getByLabelText('Change profile photo')).toBeTruthy();
      await fireEvent.press(screen.getByText('Remove photo'));
      expect(screen.getByText('Remove your photo?')).toBeTruthy();
      await fireEvent.press(screen.getAllByText('Remove photo')[1]);

      expect(remove.mutate).toHaveBeenCalledTimes(1);
    });

    it('has no Remove without a photo', async () => {
      signedIn(makeUser({ image: null }));
      await render(<ProfileScreen />);

      expect(screen.queryByText('Remove photo')).toBeNull();
    });

    it('shows the upload in progress and ignores another pick meanwhile', async () => {
      useUploadAvatarMock.mockReturnValue({ ...mutationStub(), isPending: true });
      signedIn(makeUser({ image: 'users/u1/avatar/a.jpg' }));
      await render(<ProfileScreen />);

      expect(screen.getByText('Uploading photo…')).toBeTruthy();
      expect(screen.queryByText('Remove photo')).toBeNull();
      await fireEvent.press(screen.getByLabelText('Change profile photo'));
      expect(pickAvatarMock).not.toHaveBeenCalled();
    });
  });
});
