import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSignOut } from '@/api/auth.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSessionStore } from '@/stores/session-store';
import { TabBarInset } from '@/theme/platform';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/theme/tokens';
import { FontFamily } from '@/theme/typography';

/** Canvas 11 shows the avatar as initials — there is no upload flow. */
function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProfileScreen() {
  const user = useSessionStore((state) => state.user);
  const signOutMutation = useSignOut();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3">Profile</ThemedText>

        {user && (
          <>
            <Card style={styles.identity}>
              <View style={styles.avatar}>
                <ThemedText style={styles.initials}>{initialsOf(user.name)}</ThemedText>
              </View>
              <ThemedText type="h5">{user.name}</ThemedText>
              <ThemedText type="body" color="textMuted">
                {user.email}
              </ThemedText>
            </Card>

            <Card>
              <DetailRow label="Display name" value={user.name} />
              <View style={styles.divider} />
              <DetailRow label="Email" value={user.email} />
              <View style={styles.divider} />
              <DetailRow
                label="Member since"
                value={new Date(user.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  year: 'numeric',
                })}
              />
            </Card>
          </>
        )}

        {/* Canvas styles sign-out as a secondary button in danger, not a primary action. */}
        <Button
          variant="secondary"
          className="border-danger-300"
          disabled={signOutMutation.isPending}
          onPress={() => signOutMutation.mutate()}
        >
          <ButtonText className="text-danger-700">
            {signOutMutation.isPending ? 'Signing out…' : 'Sign out'}
          </ButtonText>
        </Button>
      </SafeAreaView>
    </ThemedView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="body" color="textMuted">
        {label}
      </ThemedText>
      <ThemedText type="label" style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
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
  identity: {
    alignItems: 'center',
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FontFamily.body,
    fontSize: 22,
    color: Colors.neutral[700],
  },
  divider: {
    height: 1,
    backgroundColor: Colors.neutral[300],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[3],
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
