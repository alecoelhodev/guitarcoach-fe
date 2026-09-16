import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePracticeSheet } from '@/features/session/practice-sheet-provider';
import { Colors, Radius, Spacing } from '@/theme/tokens';

/**
 * Canvas 02c — Home for someone with no routines and no history.
 *
 * All three entry points stay visible (library, AI Coach, blank session), and the
 * "This week" card keeps its place so the layout does not jump once data arrives.
 */
export function HomeEmptyState() {
  const practiceSheet = usePracticeSheet();

  return (
    <>
      <Card quiet style={styles.card}>
        <View style={styles.illustration} />

        <ThemedText type="h5">No routines yet</ThemedText>
        <ThemedText type="body" color="textMuted">
          Build one from the shared task library, or describe what you want to work on and let the
          coach draft it.
        </ThemedText>

        <Link href="/(app)/(main)/(tabs)/library" asChild>
          <Button block>
            <ButtonText>Browse Tasks</ButtonText>
          </Button>
        </Link>

        <Link href="/(app)/(main)/coach" asChild>
          <Button variant="ghost" block>
            <ButtonText>Ask AI Coach</ButtonText>
          </Button>
        </Link>
      </Card>

      <Card quiet style={styles.play}>
        <ThemedText type="overline" color="textMuted">
          Or just play
        </ThemedText>
        <ThemedText type="body" color="textMuted">
          Start a blank session and pick tasks as you go.
        </ThemedText>
        <Button variant="secondary" block onPress={practiceSheet.open}>
          <ButtonText>Start practice</ButtonText>
        </Button>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'flex-start', gap: Spacing[2] },
  play: { gap: Spacing[2] },
  illustration: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: Colors.neutral[200],
  },
});
