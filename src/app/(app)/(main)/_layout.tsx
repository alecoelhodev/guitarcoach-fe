import { Stack } from 'expo-router';

import AppShell from '@/components/nav/app-shell';

export default function MainLayout() {
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
