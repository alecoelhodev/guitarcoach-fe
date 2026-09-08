jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { AUTOMATIC: 'automatic' },
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';

import { ExternalLink } from '@/components/external-link';
import { linkHrefs } from '@/test/expo-router';

const openBrowserAsyncMock = openBrowserAsync as jest.MockedFunction<typeof openBrowserAsync>;

const HREF = 'https://example.com/lesson';

/**
 * Only the native branch is reachable here, and deliberately so.
 *
 * Expo's babel preset **inlines `process.env.EXPO_OS` at compile time** — which is why
 * `eslint-plugin-expo` bans destructuring or dynamically indexing it. Verified: assigning
 * `process.env.EXPO_OS = 'web'` inside a test changes nothing, because
 * `process.env.EXPO_OS !== 'web'` has already been baked to the preset's platform (`ios`).
 * Covering the web fall-through would need a second Jest project on `jest-expo/web`, which is
 * a lot of configuration for one `return`.
 */
describe('ExternalLink', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens an in-app browser rather than leaving the app', async () => {
    await render(<ExternalLink href={HREF}>Open lesson</ExternalLink>);

    await fireEvent.press(screen.getByText('Open lesson'));

    expect(openBrowserAsyncMock).toHaveBeenCalledWith(HREF, {
      presentationStyle: 'automatic',
    });
  });

  it('passes the href straight through to the underlying Link', async () => {
    await render(<ExternalLink href={HREF}>Open lesson</ExternalLink>);

    expect(linkHrefs).toEqual([HREF]);
  });

  it('renders its children as the link text', async () => {
    await render(<ExternalLink href={HREF}>Open lesson</ExternalLink>);

    expect(screen.getByText('Open lesson')).toBeTruthy();
  });
});
