import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { shouldRetry } from '@/api/errors';
import { CACHE_MAX_AGE_MS } from '@/api/persist';

// `isConnected` alone is a link check: a captive portal answers it true while every request
// is intercepted, so the retry logic kept firing into a wall. `isInternetReachable` is the
// probe result, and it is `null` until the first probe settles — treat only an explicit
// `false` as offline so the first seconds after launch aren't spent reporting no connection.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) =>
    setOnline(!!state.isConnected && state.isInternetReachable !== false),
  ),
);

AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Must be >= the persister's `maxAge`. TanStack garbage-collects an inactive query on
      // `gcTime` and drops it from the dehydrated snapshot with it, so the default 5 minutes
      // meant the 24h cache `PersistQueryClientProvider` is configured to keep only ever held
      // whatever had been active in the last five. See persistQueryClient's "How It Works".
      gcTime: CACHE_MAX_AGE_MS,
      retry: shouldRetry,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});
