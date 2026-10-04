import type { ErrorEvent } from '@sentry/react-native';
import * as Sentry from '@sentry/react-native';

import {
  initMonitoring,
  reportError,
  scrubBreadcrumb,
  scrubEvent,
  setMonitoringUser,
} from '@/lib/monitoring';

const DSN = 'https://key@o1.ingest.sentry.io/1';

function initOptions() {
  return jest.mocked(Sentry.init).mock.calls[0][0] ?? {};
}

describe('initMonitoring', () => {
  const dev = __DEV__;

  beforeEach(() => jest.mocked(Sentry.init).mockClear());
  // Delete the keys rather than reassign `process.env`: under jest-expo the module under test
  // keeps reading the original object, so a replacement silently empties its env.
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    delete process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
    Object.assign(globalThis, { __DEV__: dev });
  });

  function setDev(value: boolean) {
    Object.assign(globalThis, { __DEV__: value });
  }

  it('is disabled without a DSN, even in a release build', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    setDev(false);
    initMonitoring();

    expect(initOptions().enabled).toBe(false);
  });

  it('is disabled in development, even with a DSN', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN;
    setDev(true);
    initMonitoring();

    expect(initOptions().enabled).toBe(false);
  });

  it('is enabled in a release build with a DSN, without default PII', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN;
    setDev(false);
    initMonitoring();

    expect(initOptions()).toMatchObject({
      dsn: DSN,
      enabled: true,
      sendDefaultPii: false,
      environment: 'production',
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
  });

  it('takes the environment from the env var when set', () => {
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT = 'preview';
    initMonitoring();

    expect(initOptions().environment).toBe('preview');
  });
});

describe('scrubEvent', () => {
  it('drops credentials, bodies and query strings from the request', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        url: 'https://api.example.com/sessions?token=abc#frag',
        method: 'POST',
        cookies: { session: 'secret' },
        data: '{"notes":"private"}',
        query_string: 'token=abc',
        headers: {
          Cookie: 'session=secret',
          authorization: 'Bearer abc',
          'Set-Cookie': 'session=secret',
          'Content-Type': 'application/json',
        },
      },
    } as ErrorEvent);

    expect(event.request).toEqual({
      url: 'https://api.example.com/sessions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('keeps only the opaque user id', () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: 'u1', email: 'a@example.com', ip_address: '1.2.3.4', username: 'alex' },
    } as ErrorEvent);

    expect(event.user).toEqual({ id: 'u1' });
  });

  it('scrubs breadcrumbs already attached to the event', () => {
    const event = scrubEvent({
      type: undefined,
      breadcrumbs: [{ category: 'fetch', data: { url: 'https://x.test/a?email=a@example.com' } }],
    } as ErrorEvent);

    expect(event.breadcrumbs?.[0].data?.url).toBe('https://x.test/a');
  });
});

describe('scrubBreadcrumb', () => {
  it('strips query strings from request and navigation URLs', () => {
    const crumb = scrubBreadcrumb({
      category: 'navigation',
      data: { url: '/a?x=1', from: '/b?email=a@example.com', to: '/c#top', status_code: 200 },
    });

    expect(crumb.data).toEqual({ url: '/a', from: '/b', to: '/c', status_code: 200 });
  });
});

describe('setMonitoringUser', () => {
  it('sends the id and nothing else', () => {
    setMonitoringUser('u1');

    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: 'u1' });
  });

  it('clears the user on sign-out', () => {
    setMonitoringUser(null);

    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
  });
});

describe('reportError', () => {
  it('captures the error', () => {
    const error = new Error('boom');
    reportError(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
