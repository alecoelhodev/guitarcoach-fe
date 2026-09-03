import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSignOut } from '@/api/auth.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/stores/session-store';
import { MaxContentWidth, Spacing, TabBarInset } from '@/theme/tokens';

export function ProfileScreen() {
  const user = useSessionStore((state) => state.user);
  const signOutMutation = useSignOut();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3">Profile</ThemedText>
        {user && (
          <ThemedView style={{ gap: Spacing[1] }}>
            <ThemedText type="h5">{user.name}</ThemedText>
            <ThemedText type="body" color="textMuted">
              {user.email}
            </ThemedText>
          </ThemedView>
        )}
        <Button
          variant="secondary"
          loading={signOutMutation.isPending}
          onPress={() => signOutMutation.mutate()}
        >
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
