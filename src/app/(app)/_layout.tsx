import { Redirect, Stack, usePathname } from 'expo-router';

import { ErrorBoundaryFallback } from '@/components/error-boundary-fallback';
import { useSessionStore } from '@/stores/session-store';

export { ErrorBoundaryFallback as ErrorBoundary };

export default function AppLayout() {
  const status = useSessionStore((state) => state.status);
  const pathname = usePathname();

  // The root layout holds the splash while this is 'loading'; render nothing rather than
  // mounting the app shell and firing queries against a session we don't have yet.
  if (status === 'loading') return null;

  if (status === 'unauthenticated') {
    return <Redirect href={`/(auth)/sign-in?next=${encodeURIComponent(pathname)}`} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(main)" />
      {/* Named rather than inherited: a `fullScreenModal` defaults to a horizontal push on
          Android, which reads as navigating deeper into the app rather than as entering a
          session that covers it. */}
      <Stack.Screen
        name="session/active"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}
