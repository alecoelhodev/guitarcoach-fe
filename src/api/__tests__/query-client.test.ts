import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { shouldRetry } from '@/api/errors';
import { storage } from '@/lib/storage';
import { TabBarInset } from '@/theme/platform';

/**
 * The app's real `QueryClient` plus the small modules that sit beside it.
 *
 * `query-client.ts` registers a NetInfo listener and an AppState listener at module scope, so
 * this suite is also what proves those run at all under Jest. NetInfo is mocked globally in
 * `jest.setup.ts` — unmocked it does not fail a test, it kills the worker process.
 *
 * The `AppState` spy has to be installed *before* `query-client` loads, and `import`
 * statements hoist above every statement in the file — hence the `require` below rather than a
 * seventh import.
 */

const appStateHandlers: Record<string, (status: string) => void> = {};

jest.spyOn(AppState, 'addEventListener').mockImplementation(((
  event: string,
  handler: (status: string) => void,
) => {
  appStateHandlers[event] = handler;
  return { remove: jest.fn() };
}) as never);

const { queryClient } = require('@/api/query-client') as typeof import('@/api/query-client');

describe('queryClient defaults', () => {
  it('shares one client instance across importers', () => {
    // `require`, not a dynamic `import` — Jest 29 without --experimental-vm-modules rejects
    // the latter with "A dynamic import callback was invoked without".
    const again = require('@/api/query-client').queryClient;

    expect(again).toBe(queryClient);
  });

  it('holds queries stale-free for 30s and cached for 5 minutes', () => {
    const { queries } = queryClient.getDefaultOptions();

    expect(queries?.staleTime).toBe(30_000);
    expect(queries?.gcTime).toBe(5 * 60_000);
  });

  it('delegates retry policy to shouldRetry rather than a bare number', () => {
    const { queries } = queryClient.getDefaultOptions();

    // The identity matters: `shouldRetry` is what keeps a 401 from being retried three times
    // while a 503 is.
    expect(queries?.retry).toBe(shouldRetry);
  });

  it('refetches on focus and on reconnect, which is what the two listeners are for', () => {
    const { queries } = queryClient.getDefaultOptions();

    expect(queries?.refetchOnWindowFocus).toBe(true);
    expect(queries?.refetchOnReconnect).toBe(true);
  });

  it('never retries a mutation — a half-applied write is worse than a failed one', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(0);
  });
});

describe('module-scope listeners', () => {
  afterAll(() => {
    // Leave the managers as the rest of the run found them.
    onlineManager.setOnline(true);
    focusManager.setFocused(undefined);
  });

  it('maps NetInfo connectivity onto onlineManager', () => {
    const netInfo = require('@react-native-community/netinfo').default;
    expect(netInfo.addEventListener).toHaveBeenCalled();

    const [handler] = netInfo.addEventListener.mock.calls[0];

    handler({ isConnected: false });
    expect(onlineManager.isOnline()).toBe(false);

    handler({ isConnected: true });
    expect(onlineManager.isOnline()).toBe(true);

    // `!!state.isConnected` — a null from NetInfo has to read as offline, not crash.
    handler({ isConnected: null });
    expect(onlineManager.isOnline()).toBe(false);
  });

  it('treats only an active app as focused', () => {
    const handler = appStateHandlers.change;
    expect(handler).toBeDefined();

    handler('background');
    expect(focusManager.isFocused()).toBe(false);

    handler('inactive');
    expect(focusManager.isFocused()).toBe(false);

    handler('active');
    expect(focusManager.isFocused()).toBe(true);
  });
});

describe('storage', () => {
  it('returns null rather than undefined for a miss, as zustand/persist requires', async () => {
    expect(await storage.getItem('absent')).toBeNull();
  });

  it('round-trips a value and removes it', async () => {
    await storage.setItem('k', 'v');
    expect(await storage.getItem('k')).toBe('v');

    await storage.removeItem('k');

    expect(await storage.getItem('k')).toBeNull();
  });
});

describe('TabBarInset', () => {
  it('resolves to the iOS measurement under the iOS-only preset', () => {
    // jest-expo's default preset sets `haste.defaultPlatform: 'ios'`, so this is the ios arm
    // of the `Platform.select`. The `?? 0` fallback is only reachable on web.
    expect(TabBarInset).toBe(50);
  });
});
