import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Button, ButtonText } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MaxContentWidth, Spacing } from '@/theme/tokens';

/**
 * Expo Router's unmatched-route convention. Without this file an unknown deep link falls
 * through to the router's built-in development screen, which has no production behaviour and
 * no way back into the app.
 *
 * The link is a `Button` rather than a `View`, because a `Link asChild` child has to accept
 * `onPress` — see AGENTS.md.
 */
export default function NotFoundScreen() {
  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="This page doesn't exist"
          message="The link may be out of date, or the thing it pointed at was removed."
        />
        <View style={styles.action}>
          <Link href="/(app)/(main)/(tabs)" asChild>
            <Button variant="secondary">
              <ButtonText>Go to Home</ButtonText>
            </Button>
          </Link>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing[6],
    gap: Spacing[4],
  },
  action: { alignItems: 'center' },
});
