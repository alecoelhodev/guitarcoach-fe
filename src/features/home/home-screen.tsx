import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSessionsSummary } from '@/api/sessions.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useSessionStore } from '@/stores/session-store';
import { filterThisWeek } from '@/lib/date-grouping';
import { formatMinutes, sumSessionMinutes } from '@/lib/duration';
import { MaxContentWidth, Spacing, TabBarInset } from '@/theme/tokens';

export function HomeScreen() {
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const { data, isPending } = useSessionsSummary();

  const activeSessionTasks = useActiveSessionStore((state) => state.tasks);
  const resetActiveSession = useActiveSessionStore((state) => state.reset);
  const [showResumePrompt, setShowResumePrompt] = useState(() => activeSessionTasks.length > 0);

  const sessions = data?.data ?? [];
  const thisWeek = filterThisWeek(sessions);
  const totalMinutes = thisWeek.reduce((sum, session) => sum + sumSessionMinutes(session), 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="h3">{user ? `Welcome back, ${user.name}` : 'Welcome back'}</ThemedText>

          <Card>
            <ThemedText type="overline" color="textMuted">
              This week
            </ThemedText>
            {isPending ? (
              <Skeleton height={32} width={160} />
            ) : (
              <ThemedText type="h4">
                {thisWeek.length} {thisWeek.length === 1 ? 'session' : 'sessions'} ·{' '}
                {formatMinutes(totalMinutes)}
              </ThemedText>
            )}
          </Card>

          <Link href="/(app)/(main)/(tabs)/routines" asChild>
            <Button block>Start practice</Button>
          </Link>

          <Link href="/(app)/(main)/coach" asChild>
            <Button variant="secondary" block>
              Ask the AI Coach
            </Button>
          </Link>
        </ScrollView>
      </SafeAreaView>

      <ConfirmDialog
        visible={showResumePrompt}
        title="Resume practice session?"
        message="You have a practice session in progress from earlier."
        confirmLabel="Resume"
        cancelLabel="Discard"
        onConfirm={() => {
          setShowResumePrompt(false);
          router.push('/session/active');
        }}
        onCancel={() => {
          setShowResumePrompt(false);
          resetActiveSession();
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  scroll: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing[4],
    paddingBottom: TabBarInset + Spacing[4],
    gap: Spacing[4],
  },
});
