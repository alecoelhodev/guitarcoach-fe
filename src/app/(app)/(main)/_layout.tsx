import { Stack } from 'expo-router';

import { ErrorBoundaryFallback } from '@/components/error-boundary-fallback';
import AppShell from '@/components/nav/app-shell';

/**
 * Without this, a render throw in any screen below unwound to `(app)/_layout` and replaced
 * the whole signed-in app — nav chrome included. Caught here, the shell survives and only
 * the content area shows the fallback.
 */
export { ErrorBoundaryFallback as ErrorBoundary };

export default function MainLayout() {
  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="routines/new" />
        <Stack.Screen name="routines/[id]/index" />
        <Stack.Screen
          name="routines/[id]/add-tasks"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="library/new" />
        <Stack.Screen name="library/[id]" />
        <Stack.Screen name="history/index" />
        <Stack.Screen name="history/[id]" />
        <Stack.Screen name="coach" />
      </Stack>
    </AppShell>
  );
}
