jest.mock('@/api/avatar.queries', () => ({ useAvatarUrl: jest.fn() }));
jest.mock('@/features/profile/use-gravatar-url', () => ({ useGravatarUrl: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { useAvatarUrl } from '@/api/avatar.queries';
import { Avatar, initialsOf } from '@/features/profile/avatar';
import { useGravatarUrl } from '@/features/profile/use-gravatar-url';
import { makeUser } from '@/test/fixtures';

const useAvatarUrlMock = useAvatarUrl as unknown as jest.Mock;
const useGravatarUrlMock = useGravatarUrl as unknown as jest.Mock;

function withUrl(url?: string) {
  useAvatarUrlMock.mockReturnValue({ data: url ? { url } : undefined });
}

function withGravatar(url?: string) {
  useGravatarUrlMock.mockReturnValue({ data: url });
}

beforeEach(() => withGravatar(undefined));

describe('initialsOf', () => {
  it.each([
    ['Jordan Lee', 2, 'JL'],
    ['Jordan Lee', 1, 'J'],
    ['  jordan   lee  smith ', 2, 'JL'],
    ['', 2, ''],
  ])('%j, %i → %j', (name, count, expected) => {
    expect(initialsOf(name, count)).toBe(expected);
  });
});

describe('Avatar', () => {
  it('shows initials alone when no photo is set', async () => {
    withUrl(undefined);
    await render(<Avatar user={makeUser({ name: 'Jordan Lee' })} size="lg" />);

    expect(screen.getByText('JL')).toBeTruthy();
    expect(screen.queryByTestId('avatar-photo')).toBeNull();
    expect(useAvatarUrlMock).toHaveBeenCalledWith(undefined);
  });

  it('lays the photo over the initials, which stay as the loading state', async () => {
    withUrl('https://signed/a');
    await render(
      <Avatar user={makeUser({ name: 'Jordan', image: 'users/u1/avatar/a.jpg' })} size="sm" />,
    );

    expect(screen.getByTestId('avatar-photo').props.source).toEqual({ uri: 'https://signed/a' });
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('falls back to initials when the photo fails, and tries a fresh URL again', async () => {
    withUrl('https://signed/expired');
    const user = makeUser({ name: 'Jordan', image: 'users/u1/avatar/a.jpg' });
    const view = await render(<Avatar user={user} size="lg" />);

    await fireEvent(screen.getByTestId('avatar-photo'), 'error');
    expect(screen.queryByTestId('avatar-photo')).toBeNull();

    withUrl('https://signed/fresh');
    await view.rerender(<Avatar user={user} size="lg" />);
    expect(screen.getByTestId('avatar-photo').props.source).toEqual({
      uri: 'https://signed/fresh',
    });
  });

  it('shows the Gravatar when no photo was uploaded', async () => {
    withUrl(undefined);
    withGravatar('https://gravatar.com/avatar/abc?s=200&d=404');
    await render(<Avatar user={makeUser({ name: 'Jordan', image: null })} size="lg" />);

    expect(screen.getByTestId('avatar-photo').props.source).toEqual({
      uri: 'https://gravatar.com/avatar/abc?s=200&d=404',
    });
    expect(useGravatarUrlMock).toHaveBeenCalledWith('jordan@example.com', true);
  });

  it('prefers an uploaded photo and does not look the Gravatar up', async () => {
    withUrl('https://signed/a');
    withGravatar(undefined);
    await render(
      <Avatar user={makeUser({ name: 'Jordan', image: 'users/u1/avatar/a.jpg' })} size="lg" />,
    );

    expect(screen.getByTestId('avatar-photo').props.source).toEqual({ uri: 'https://signed/a' });
    expect(useGravatarUrlMock).toHaveBeenCalledWith('jordan@example.com', false);
  });

  it('falls back to initials when the email has no Gravatar', async () => {
    withUrl(undefined);
    withGravatar('https://gravatar.com/avatar/none?s=200&d=404');
    await render(<Avatar user={makeUser({ name: 'Jordan Lee', image: null })} size="lg" />);

    await fireEvent(screen.getByTestId('avatar-photo'), 'error');

    expect(screen.queryByTestId('avatar-photo')).toBeNull();
    expect(screen.getByText('JL')).toBeTruthy();
  });
});
