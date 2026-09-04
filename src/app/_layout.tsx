import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack, type Theme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { setUnauthorizedHandler } from '@/api/client';
import { CACHE_BUSTER, CACHE_MAX_AGE_MS, purgePersistedCache, queryPersister } from '@/api/persist';
import { queryClient } from '@/api/query-client';
import { ErrorBoundaryFallback } from '@/components/error-boundary-fallback';
import { ToastHost } from '@/components/toast-host';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useSessionStore } from '@/stores/session-store';
import { Colors } from '@/theme/tokens';

import '@/global.css';

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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const hydrate = useSessionStore((state) => state.hydrate);
  const status = useSessionStore((state) => state.status);

  // Session restore is a network round-trip, so hold the splash until it settles —
  // otherwise `status === 'loading'` falls through both group guards and whichever
  // group the URL points at mounts and starts firing queries.
  const ready = fontsLoaded && status !== 'loading';

  useEffect(() => {
    setUnauthorizedHandler(() => {
      useSessionStore.getState().clear();
      // Same reason the deliberate sign-out path clears it: an expired cookie leaves the
      // previous user's routines and sessions cached for whoever signs in next. The
      // persisted snapshot has to go too — `clear()` only empties memory.
      queryClient.clear();
      void purgePersistedCache();
    });
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GluestackUIProvider mode="dark">
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            buster: CACHE_BUSTER,
            maxAge: CACHE_MAX_AGE_MS,
          }}
        >
          <BottomSheetModalProvider>
            <ThemeProvider value={navigationTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
              <ToastHost />
            </ThemeProvider>
          </BottomSheetModalProvider>
        </PersistQueryClientProvider>
      </GluestackUIProvider>
    </GestureHandlerRootView>
  );
}
