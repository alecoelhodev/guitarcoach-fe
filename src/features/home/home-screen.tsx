import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSessionsSummary } from '@/api/sessions.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, ButtonText } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ActiveRoutines } from '@/features/home/active-routines';
import { HomeEmptyState } from '@/features/home/home-empty-state';
import { RecentSessions } from '@/features/home/recent-sessions';
import { ThisWeekCard } from '@/features/home/this-week-card';
import { TodaysPracticeCard, TodaysPracticeSkeleton } from '@/features/home/todays-practice-card';
import { useTodaysPractice } from '@/features/home/use-todays-practice';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useIsWide } from '@/hooks/use-is-wide';
import { filterThisWeek } from '@/lib/date-grouping';
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
  const isWide = useIsWide();
  const user = useSessionStore((state) => state.user);
  const { data, isPending } = useSessionsSummary();
  const { routine, taskTitles, activeRoutines, hasLoaded } = useTodaysPractice();

  const activeSessionTasks = useActiveSessionStore((state) => state.tasks);
  const resetActiveSession = useActiveSessionStore((state) => state.reset);
  // Derived rather than latched into state: `persist` rehydrates AsyncStorage asynchronously,
  // so the task list is still empty on the first render and a `useState` initializer would
  // capture "no session" permanently.
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const showResumePrompt = !resumeDismissed && activeSessionTasks.length > 0;

  const sessions = data?.data ?? [];
  const thisWeek = filterThisWeek(sessions);

  // Canvas 02c. Gated on `hasLoaded` rather than `!isPending` alone, or the
  // new-user state flashes on every cold start before the lists resolve.
  const isNewUser = hasLoaded && activeRoutines.length === 0 && sessions.length === 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        style={isWide ? styles.safeAreaWide : styles.safeArea}
        edges={['top']}
        testID="home-safe-area"
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View style={styles.greeting}>
              <ThemedText type="h3">
                {user
                  ? `${isNewUser ? 'Welcome' : partOfDay()}, ${user.name}`
                  : isNewUser
                    ? 'Welcome'
                    : partOfDay()}
              </ThemedText>
              <ThemedText type="body" color="textMuted">
                {isNewUser ? "Let's set up your first routine." : 'Ready for 30 minutes?'}
              </ThemedText>
            </View>

            {/* Canvas 2a promotes the AI Coach CTA into the header, where the
                width allows it; mobile keeps it as a full-width button below. */}
            {isWide && !isNewUser && <AskCoachButton />}

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

          {isNewUser ? (
            <>
              <HomeEmptyState />
              <ThisWeekCard sessions={thisWeek} isPending={isPending} />
            </>
          ) : (
            <>
              <View style={isWide ? styles.columns : undefined}>
                <View style={isWide ? styles.primaryColumn : undefined}>
                  {routine ? (
                    <TodaysPracticeCard
                      routine={routine}
                      taskTitles={taskTitles}
                      showViewRoutine={isWide}
                    />
                  ) : (
                    !hasLoaded && <TodaysPracticeSkeleton />
                  )}
                </View>

                <View style={isWide ? styles.secondaryColumn : undefined}>
                  <ThisWeekCard
                    sessions={thisWeek}
                    isPending={isPending}
                    figureSize={isWide ? 38 : 34}
                  />
                </View>
              </View>

              {!isWide && <AskCoachButton block />}

              <ActiveRoutines routines={activeRoutines} isWide={isWide} />
              <RecentSessions sessions={sessions} isWide={isWide} />
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
          setResumeDismissed(true);
          router.push('/session/active');
        }}
        onCancel={() => {
          setResumeDismissed(true);
          resetActiveSession();
        }}
      />
    </ThemedView>
  );
}

function AskCoachButton({ block = false }: { block?: boolean }) {
  return (
    <Link href="/(app)/(main)/coach" asChild>
      <Button variant="ghost" block={block}>
        <ButtonText>Ask AI Coach</ButtonText>
      </Button>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // The width cap has to sit on a node that is also capped at 100% of the screen,
  // or the ScrollView lays out at the full cap on a narrower phone.
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  // Canvas 2a's pane fills the width beside the rail — no content cap there.
  safeAreaWide: { flex: 1, width: '100%' },
  scroll: {
    padding: Spacing[4],
    paddingBottom: TabBarInset + Spacing[4],
    gap: Spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  greeting: { flex: 1, gap: Spacing[1] },
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
  // Canvas 2a: grid-template-columns 1.5fr 1fr.
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  primaryColumn: { flex: 1.5 },
  secondaryColumn: { flex: 1 },
});
