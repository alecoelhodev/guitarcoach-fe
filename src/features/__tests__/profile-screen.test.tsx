jest.mock('@/api/auth.queries', () => ({ useSignOut: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { useSignOut } from '@/api/auth.queries';
import { ProfileScreen } from '@/features/profile/profile-screen';
import { useSessionStore } from '@/stores/session-store';
import { makeUser } from '@/test/fixtures';
import { mutationStub } from '@/test/query-hooks';

const useSignOutMock = useSignOut as unknown as jest.MockedFunction<(...args: never[]) => unknown>;

function signedIn(user = makeUser()) {
  useSessionStore.setState({ status: 'authenticated', user });
}

beforeEach(() => {
  jest.clearAllMocks();
  useSignOutMock.mockReturnValue(mutationStub());
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

  it('formats "member since" as a month and year', async () => {
    signedIn(makeUser({ createdAt: '2026-03-15T00:00:00.000Z' }));
    await render(<ProfileScreen />);

    // Matched loosely on purpose: `toLocaleDateString(undefined, …)` follows Node's default
    // locale, which differs between a laptop and CI's ICU build. The TZ pin in
    // `jest.config.js` fixes the zone but not the locale.
    expect(screen.getByText(/2026/)).toBeTruthy();
  });
});
