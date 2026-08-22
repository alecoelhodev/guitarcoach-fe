import { Redirect, Stack } from 'expo-router';

import { ErrorBoundaryFallback } from '@/components/error-boundary-fallback';
import { useSessionStore } from '@/stores/session-store';

export { ErrorBoundaryFallback as ErrorBoundary };

export default function AppLayout() {
  const status = useSessionStore((state) => state.status);

  if (status === 'unauthenticated') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(main)" />
      <Stack.Screen name="session/active" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
