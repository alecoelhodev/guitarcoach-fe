import { describeApiTarget, resolveApiTarget } from '@/api/base-url';

/**
 * The resolver is pure so the interesting cases — a phone given `localhost`, a tunnel, an empty
 * override — can be asserted without a dev server. Every one of them used to surface as the same
 * `ApiError('No connection', 0)`.
 */

const CLOUD = 'https://guitarcoach-685026468764.us-east1.run.app';
const LOCAL = 'http://localhost:3000';
const LAN_HOST_URI = '192.168.1.20:8081';

describe('on web', () => {
  it('uses the shared base URL and ignores the native override', () => {
    expect(
      resolveApiTarget({ platform: 'web', apiBaseUrl: LOCAL, apiBaseUrlNative: CLOUD }),
    ).toEqual({ url: LOCAL, source: 'EXPO_PUBLIC_API_BASE_URL', lanRewritten: false });
  });

  // The browser already runs on the dev machine, so `localhost` is correct there.
  it('never rewrites localhost, even with a LAN host available', () => {
    const target = resolveApiTarget({ platform: 'web', apiBaseUrl: LOCAL, hostUri: LAN_HOST_URI });

    expect(target).toMatchObject({ url: LOCAL, lanRewritten: false });
  });

  it('is undefined when nothing is configured', () => {
    expect(resolveApiTarget({ platform: 'web' })).toBeUndefined();
  });
});

describe('on native', () => {
  it('prefers the native override and says which variable produced it', () => {
    expect(
      resolveApiTarget({ platform: 'ios', apiBaseUrl: LOCAL, apiBaseUrlNative: CLOUD }),
    ).toEqual({ url: CLOUD, source: 'EXPO_PUBLIC_API_BASE_URL_NATIVE', lanRewritten: false });
  });

  /**
   * `EXPO_PUBLIC_API_BASE_URL_NATIVE= expo start` is how the start scripts clear a stale .env
   * entry, and @expo/env treats an empty string as defined — so it reaches here as `''`. A `??`
   * would choose it over the real URL and leave the app with no backend at all.
   */
  it('falls through an empty override rather than choosing it', () => {
    expect(
      resolveApiTarget({ platform: 'ios', apiBaseUrl: CLOUD, apiBaseUrlNative: '' }),
    ).toMatchObject({ url: CLOUD, source: 'EXPO_PUBLIC_API_BASE_URL' });
  });

  it('is undefined when nothing is configured', () => {
    expect(resolveApiTarget({ platform: 'android', apiBaseUrlNative: '' })).toBeUndefined();
  });
});

describe('the LAN rewrite', () => {
  // A phone resolves `localhost` to itself, which is why running against local Docker was
  // impossible before this.
  it('swaps a loopback host for the dev machine, keeping the API port', () => {
    expect(resolveApiTarget({ platform: 'ios', apiBaseUrl: LOCAL, hostUri: LAN_HOST_URI })).toEqual(
      {
        url: 'http://192.168.1.20:3000',
        source: 'EXPO_PUBLIC_API_BASE_URL',
        lanRewritten: true,
      },
    );
  });

  it('covers 127.0.0.1 as well as localhost', () => {
    expect(
      resolveApiTarget({
        platform: 'ios',
        apiBaseUrl: 'http://127.0.0.1:3000',
        hostUri: LAN_HOST_URI,
      }),
    ).toMatchObject({ url: 'http://192.168.1.20:3000', lanRewritten: true });
  });

  /**
   * Under `expo start --tunnel`, `hostUri` is a public host that serves the bundler and has no
   * API on it. Grafting it on would swap one unreachable backend for another.
   */
  it('leaves localhost alone when hostUri is a tunnel rather than a LAN address', () => {
    expect(
      resolveApiTarget({ platform: 'ios', apiBaseUrl: LOCAL, hostUri: 'abc-xyz.exp.direct:80' }),
    ).toMatchObject({ url: LOCAL, lanRewritten: false });
  });

  it('leaves localhost alone when there is no hostUri at all', () => {
    // `hostUri` is only present under `expo start`, so a production build never rewrites.
    expect(resolveApiTarget({ platform: 'ios', apiBaseUrl: LOCAL })).toMatchObject({
      url: LOCAL,
      lanRewritten: false,
    });
  });

  it('does not touch a real host', () => {
    expect(
      resolveApiTarget({ platform: 'ios', apiBaseUrlNative: CLOUD, hostUri: LAN_HOST_URI }),
    ).toMatchObject({ url: CLOUD, lanRewritten: false });
  });

  it('passes a malformed URL through for the caller to reject, rather than throwing', () => {
    expect(
      resolveApiTarget({ platform: 'ios', apiBaseUrl: 'not a url', hostUri: LAN_HOST_URI }),
    ).toMatchObject({ url: 'not a url', lanRewritten: false });
  });
});

describe('describeApiTarget', () => {
  it('reduces a URL to the host', () => {
    expect(
      describeApiTarget({ url: LOCAL, source: 'EXPO_PUBLIC_API_BASE_URL', lanRewritten: false }),
    ).toBe('localhost:3000');
  });

  it('marks a rewritten host so a LAN address is not mistaken for configuration', () => {
    expect(
      describeApiTarget({
        url: 'http://192.168.1.20:3000',
        source: 'EXPO_PUBLIC_API_BASE_URL',
        lanRewritten: true,
      }),
    ).toBe('192.168.1.20:3000 (LAN)');
  });
});
