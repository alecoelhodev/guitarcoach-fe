import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSessionsSummary } from '@/api/sessions.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionCard } from '@/features/history/session-card';
import { useActiveSessionStore } from '@/features/session/session-store';
import { filterThisWeek } from '@/lib/date-grouping';
import { sumSessionMinutes } from '@/lib/duration';
import { useSessionStore } from '@/stores/session-store';
import { TabBarInset } from '@/theme/platform';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/theme/tokens';

/** Canvas 02 greets by time of day ("Evening, Jordan"). */
function partOfDay(hour = new Date().getHours()) {
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

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
  const recent = sessions[0];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="h3" style={styles.greeting}>
              {user ? `${partOfDay()}, ${user.name}` : partOfDay()}
            </ThemedText>
            {user && (
              <Link href="/(app)/(main)/(tabs)/profile" asChild>
                <View style={styles.avatar} accessibilityRole="button" accessibilityLabel="Profile">
                  <ThemedText type="label" color="textMuted">
                    {user.name.slice(0, 1).toUpperCase()}
                  </ThemedText>
                </View>
              </Link>
            )}
          </View>

          {/* Canvas is explicit that minutes and session count are the only two
              progress numbers the backend can honestly support. */}
          {isPending ? (
            <Card>
              <ThemedText type="overline" color="textMuted">
                This week
              </ThemedText>
              <Skeleton width="45%" />
            </Card>
          ) : thisWeek.length === 0 ? (
            <Card quiet>
              <ThemedText type="overline" color="textMuted">
                This week
              </ThemedText>
              <ThemedText type="body" color="textMuted">
                Nothing logged yet. Your minutes and sessions appear here after your first practice.
              </ThemedText>
            </Card>
          ) : (
            <Card>
              <ThemedText type="overline" color="textMuted">
                This week
              </ThemedText>
              <View style={styles.figures}>
                <Figure value={totalMinutes} label="minutes" />
                <View style={styles.figureDivider} />
                <Figure value={thisWeek.length} label="sessions" />
              </View>
            </Card>
          )}

          <Link href="/(app)/(main)/(tabs)/routines" asChild>
            <Button block>Start Practice</Button>
          </Link>

          <Link href="/(app)/(main)/coach" asChild>
            <Button variant="ghost" block>
              Ask AI Coach
            </Button>
          </Link>

          {recent && (
            <>
              <View style={styles.sectionHeader}>
                <ThemedText type="overline" color="textMuted">
                  Recent session
                </ThemedText>
                <Link href="/(app)/(main)/history" asChild>
                  <ThemedText type="label" style={styles.link}>
                    See all
                  </ThemedText>
                </Link>
              </View>
              <SessionCard session={recent} />
            </>
          )}
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

/** Canvas `.big` — the only oversized numerals in the app outside the session clock. */
function Figure({ value, label }: { value: number; label: string }) {
  return (
    <View>
      <ThemedText type="display" style={styles.figureValue}>
        {value}
      </ThemedText>
      <ThemedText type="body" color="textMuted">
        {label}
      </ThemedText>
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  greeting: { flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  figures: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[4],
  },
  figureValue: {
    fontSize: 34,
    lineHeight: 34,
  },
  figureDivider: {
    width: 1,
    height: 34,
    backgroundColor: Colors.neutral[300],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Canvas uses accent-700 for links and small accent text, never the base accent.
  link: { color: Colors.accentRamp[700] },
});
