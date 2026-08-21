import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listSessions } from '@/api/sessions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessionStore } from '@/features/auth/session-store';
import { filterThisWeek } from '@/lib/date-grouping';
import { formatMinutes, sumSessionMinutes } from '@/lib/duration';
import { MaxContentWidth, Spacing, TabBarInset } from '@/theme/tokens';

export function HomeScreen() {
  const user = useSessionStore((state) => state.user);
  const { data: sessions, isPending } = useQuery({ queryKey: ['sessions'], queryFn: listSessions });

  const thisWeek = sessions ? filterThisWeek(sessions) : [];
  const totalMinutes = thisWeek.reduce((sum, session) => sum + sumSessionMinutes(session), 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="h3">
            {user ? `Welcome back, ${user.displayName}` : 'Welcome back'}
          </ThemedText>

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

          <Link href="/(app)/(tabs)/routines" asChild>
            <Button block>Start practice</Button>
          </Link>

          <Link href="/(app)/coach" asChild>
            <Button variant="secondary" block>
              Ask the AI Coach
            </Button>
          </Link>
        </ScrollView>
      </SafeAreaView>
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
