import { Redirect, Stack } from 'expo-router';

import AppShell from '@/components/nav/app-shell';
import { useSessionStore } from '@/features/auth/session-store';

export default function AppLayout() {
  const status = useSessionStore((state) => state.status);

  if (status === 'unauthenticated') return <Redirect href="/(auth)/sign-in" />;

  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="routines/[id]" />
        <Stack.Screen name="library/[id]" />
        <Stack.Screen name="history/index" />
        <Stack.Screen name="history/[id]" />
        <Stack.Screen name="coach" />
      </Stack>
    </AppShell>
  );
}
