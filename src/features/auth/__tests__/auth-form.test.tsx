import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { requestPasswordReset, signIn } from '@/api/auth';
import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { AuthForm } from '@/features/auth/auth-form';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/api/auth', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  requestPasswordReset: jest.fn(),
}));

const signInMock = signIn as jest.MockedFunction<typeof signIn>;
const requestPasswordResetMock = requestPasswordReset as jest.MockedFunction<
  typeof requestPasswordReset
>;

const user = {
  id: 'u1',
  email: 'jordan@example.com',
  emailVerified: true,
  name: 'Jordan',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function signInWith(email: string, password: string) {
  await fireEvent.changeText(screen.getByPlaceholderText('jordan@example.com'), email);
  await fireEvent.changeText(screen.getByTestId('password-input'), password);
  await fireEvent.press(screen.getByTestId('submit'));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sign in', () => {
  it('reports an incorrect password without navigating away', async () => {
    signInMock.mockRejectedValue(new ApiError('Invalid email or password', 401));
    await render(<AuthForm />);

    await signInWith('jordan@example.com', 'wrong-password');

    expect(await screen.findByText('Email or password is incorrect')).toBeTruthy();
    expect(screen.getByText('Check both and try again.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('surfaces the rate limit the backend enforces on sign-in', async () => {
    signInMock.mockRejectedValue(new ApiError('Too many requests', 429));
    await render(<AuthForm />);

    await signInWith('jordan@example.com', 'correct-horse');

    expect(await screen.findByText('Too many attempts')).toBeTruthy();
    expect(screen.getByText('Try again in about a minute.')).toBeTruthy();
  });

  it('offers a working retry when the server is unreachable', async () => {
    signInMock.mockRejectedValue(new ApiError('No connection', OFFLINE_STATUS));
    await render(<AuthForm />);

    await signInWith('jordan@example.com', 'correct-horse');
    expect(await screen.findByText('No connection')).toBeTruthy();

    signInMock.mockResolvedValue({ user });
    await fireEvent.press(screen.getByText('Retry'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('lands on the path the guard was protecting', async () => {
    signInMock.mockResolvedValue({ user });
    await render(<AuthForm next="/routines/abc" />);

    await signInWith('jordan@example.com', 'correct-horse');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/routines/abc'));
  });

  it('ignores a next param that points off-app', async () => {
    signInMock.mockResolvedValue({ user });
    await render(<AuthForm next="https://evil.com" />);

    await signInWith('jordan@example.com', 'correct-horse');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('blocks an invalid email at the client without calling the API', async () => {
    await render(<AuthForm />);

    await signInWith('not-an-email', 'correct-horse');

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('blocks a password the backend would reject anyway', async () => {
    await render(<AuthForm />);

    await signInWith('jordan@example.com', 'short');

    expect(await screen.findByText('At least 8 characters.')).toBeTruthy();
    expect(signInMock).not.toHaveBeenCalled();
  });
});

describe('forgot password', () => {
  it('does not call the API until there is a valid email to send to', async () => {
    await render(<AuthForm />);

    await fireEvent.press(screen.getByText('Forgot password?'));

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('confirms identically for a registered and an unregistered email', async () => {
    requestPasswordResetMock.mockResolvedValue({ status: true, message: 'ok' });

    for (const email of ['registered@example.com', 'nobody@example.com']) {
      const view = await render(<AuthForm />);
      await fireEvent.changeText(screen.getByPlaceholderText('jordan@example.com'), email);
      await fireEvent.press(screen.getByText('Forgot password?'));

      // Identical copy either way — the server equalizes its own response and timing,
      // and distinguishing here would leak which emails are registered.
      expect(await screen.findByText('Reset password sent')).toBeTruthy();
      expect(screen.getByText('Check your email for a reset link.')).toBeTruthy();
      await view.unmount();
    }

    expect(requestPasswordResetMock).toHaveBeenCalledTimes(2);
  });
});

describe('mode switching', () => {
  it('swaps in place, keeping the typed email and clearing the banner', async () => {
    signInMock.mockRejectedValue(new ApiError('Invalid email or password', 401));
    await render(<AuthForm />);

    await signInWith('jordan@example.com', 'wrong-password');
    expect(await screen.findByText('Email or password is incorrect')).toBeTruthy();

    await fireEvent.press(screen.getByText('Create Account'));

    expect(screen.queryByText('Email or password is incorrect')).toBeNull();
    expect(screen.getByPlaceholderText('jordan@example.com').props.value).toBe(
      'jordan@example.com',
    );
    // Display name exists only in create mode, Forgot password only in sign-in mode.
    expect(screen.getByText('Display name')).toBeTruthy();
    expect(screen.queryByText('Forgot password?')).toBeNull();
  });
});
