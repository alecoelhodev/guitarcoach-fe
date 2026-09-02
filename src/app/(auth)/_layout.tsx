import { Redirect, Stack } from 'expo-router';

import { useSessionStore } from '@/stores/session-store';

export default function AuthLayout() {
  const status = useSessionStore((state) => state.status);

  if (status === 'loading') return null;
  if (status === 'authenticated') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
