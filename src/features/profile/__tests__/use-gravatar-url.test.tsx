jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, data: string) =>
    require('node:crypto').createHash('sha256').update(data).digest('hex'),
  ),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { digestStringAsync } from 'expo-crypto';

import { gravatarUrl, useGravatarUrl } from '@/features/profile/use-gravatar-url';
import { withQueryClient } from '@/test/query-client';

const digestMock = digestStringAsync as jest.Mock;

beforeEach(() => digestMock.mockClear());

describe('gravatarUrl', () => {
  // Gravatar's own documented example address and hash.
  it('hashes the trimmed, lower-cased email with SHA-256', async () => {
    await expect(gravatarUrl(' MyEmailAddress@example.com ')).resolves.toBe(
      'https://gravatar.com/avatar/84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee?s=200&d=404',
    );
  });
});

describe('useGravatarUrl', () => {
  it('builds the URL when enabled', async () => {
    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useGravatarUrl('jordan@example.com', true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toMatch(/^https:\/\/gravatar\.com\/avatar\//));
  });

  it.each([
    ['disabled', 'jordan@example.com', false],
    ['given no email', '', true],
  ])('hashes nothing when %s', async (_label, email, enabled) => {
    const { wrapper } = withQueryClient();
    const { result } = await renderHook(() => useGravatarUrl(email, enabled), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(digestMock).not.toHaveBeenCalled();
  });
});
