import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import * as Sentry from '@sentry/react-native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack, type Theme, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { setUnauthorizedHandler } from '@/api/client';
import { CACHE_BUSTER, CACHE_MAX_AGE_MS, dehydrateOptions, queryPersister } from '@/api/persist';
import { queryClient } from '@/api/query-client';
import { ErrorBoundaryFallback } from '@/components/error-boundary-fallback';
import { ToastHost } from '@/components/toast-host';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { initMonitoring, setMonitoringUser } from '@/lib/monitoring';
import { clearLocalSession, expireSession } from '@/stores/clear-local-session';
import { useSessionStore } from '@/stores/session-store';
import { Colors } from '@/theme/tokens';

import '@/global.css';

initMonitoring();
SplashScreen.preventAutoHideAsync();

const navigationTheme: Theme = {
  dark: true,
  colors: {
    primary: Colors.accent,
    background: Colors.bg,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.divider,
    notification: Colors.accent,
  },
  fonts: {
    regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
    medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' },
    bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
    heavy: { fontFamily: 'Inter_800ExtraBold', fontWeight: '800' },
  },
};

export { ErrorBoundaryFallback as ErrorBoundary };

// The restore runs alongside `hydrate`, so it can land after a null session has already
// cleared the client and put the previous account's snapshot back into memory.
function dropRestoreAfterSignOut() {
  if (useSessionStore.getState().status === 'unauthenticated') queryClient.clear();
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const hydrate = useSessionStore((state) => state.hydrate);
  const status = useSessionStore((state) => state.status);
  const userId = useSessionStore((state) => state.user?.id ?? null);

  // Session restore is a network round-trip, so hold the splash until it settles —
  // otherwise `status === 'loading'` falls through both group guards and whichever
  // group the URL points at mounts and starts firing queries. A font that fails to load
  // falls back to the system face rather than holding the splash forever.
  const ready = (fontsLoaded || fontError !== null) && status !== 'loading';

  useEffect(() => {
    // Same teardown as the deliberate sign-out path, and shared with it: an expired cookie
    // leaves the previous user's cached data for whoever signs in next. The in-progress
    // practice session is the exception — it is owner-stamped, so it stays and the user can
    // finish it after signing back in rather than losing unsaved minutes to a dead cookie.
    setUnauthorizedHandler(() => {
      void expireSession(queryClient);
    });
  }, []);

  useEffect(() => {
    hydrate(() => clearLocalSession(queryClient, { keepActiveSession: true }));
  }, [hydrate]);

  useEffect(() => {
    setMonitoringUser(userId);
  }, [userId]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Above the `ready` gate so static web rendering, which never loads fonts, still emits it. */}
      <Head>
        <title>Progress Pick</title>
      </Head>
      {/*
        Mounted explicitly rather than relying on the one react-navigation installs inside
        `<Stack>`: `ToastHost` below is a *sibling* of the Stack, so it sat outside that
        provider while reading the bottom inset. `initialWindowMetrics` is what keeps the
        first frame from laying out at zero insets and then jumping.
      */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <GluestackUIProvider mode="dark">
          {/*
            Above the `ready` gate, not below it. This provider reads a day-old snapshot out
            of AsyncStorage on mount, and while it sat under the gate that read did not begin
            until the fonts and the session round-trip had both finished — three waits in
            series where two of them can overlap. The splash still covers all of it.
          */}
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: queryPersister,
              buster: CACHE_BUSTER,
              maxAge: CACHE_MAX_AGE_MS,
              dehydrateOptions,
            }}
            onSuccess={dropRestoreAfterSignOut}
          >
            {ready && (
              <ThemeProvider value={navigationTheme}>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(app)" />
                </Stack>
                <ToastHost />
              </ThemeProvider>
            )}
          </PersistQueryClientProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
