import { SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSessions } from '@/api/sessions.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { SessionCard } from '@/features/history/session-card';
import { groupSessionsByDay } from '@/lib/date-grouping';
import { MaxContentWidth, Spacing } from '@/theme/tokens';

export function HistoryList() {
  const query = useSessions();
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const sessions = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3" style={styles.title}>
          History
        </ThemedText>

        <QueryState
          query={query}
          errorTitle="Couldn't load your history"
          isEmpty={sessions.length === 0}
          empty={
            <EmptyState
              title="No sessions yet"
              message="Finish a practice session to see it here."
            />
          }
        >
          {() => (
            <SectionList
              sections={groupSessionsByDay(sessions).map((group) => ({
                title: group.date,
                data: group.sessions,
              }))}
              keyExtractor={(session) => session.id}
              renderItem={({ item }) => <SessionCard session={item} />}
              renderSectionHeader={({ section }) => (
                <ThemedText type="overline" color="textMuted" style={styles.sectionHeader}>
                  {section.title}
                </ThemedText>
              )}
              contentContainerStyle={styles.list}
              ListFooterComponent={
                hasNextPage ? (
                  <Button
                    variant="secondary"
                    loading={isFetchingNextPage}
                    onPress={() => fetchNextPage()}
                  >
                    Load older sessions
                  </Button>
                ) : null
              }
            />
          )}
        </QueryState>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  title: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[2] },
  list: { padding: Spacing[4], gap: Spacing[3] },
  sectionHeader: { paddingVertical: Spacing[2] },
});
