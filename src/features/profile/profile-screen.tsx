import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/stores/session-store';
import { MaxContentWidth, Spacing, TabBarInset } from '@/theme/tokens';

export function ProfileScreen() {
  const user = useSessionStore((state) => state.user);
  const clear = useSessionStore((state) => state.clear);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      clear();
      setSigningOut(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3">Profile</ThemedText>
        {user && (
          <ThemedView style={{ gap: Spacing[1] }}>
            <ThemedText type="h5">{user.displayName}</ThemedText>
            <ThemedText type="body" color="textMuted">
              {user.email}
            </ThemedText>
          </ThemedView>
        )}
        <Button variant="secondary" loading={signingOut} onPress={handleSignOut}>
          Sign out
        </Button>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing[4],
    paddingBottom: TabBarInset + Spacing[4],
    gap: Spacing[4],
  },
});
