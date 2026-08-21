import { useQuery } from '@tanstack/react-query';
import { SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listSessions } from '@/api/sessions';
import { queryKeys } from '@/api/query-keys';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorPanel } from '@/components/ui/error-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionCard } from '@/features/history/session-card';
import { groupSessionsByDay } from '@/lib/date-grouping';
import { MaxContentWidth, Spacing } from '@/theme/tokens';

export function HistoryList() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.sessions,
    queryFn: listSessions,
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3" style={styles.title}>
          History
        </ThemedText>

        {isPending ? (
          <Skeleton height={80} />
        ) : isError ? (
          <ErrorPanel title="Couldn't load your history" onRetry={refetch} />
        ) : data.length === 0 ? (
          <EmptyState title="No sessions yet" message="Finish a practice session to see it here." />
        ) : (
          <SectionList
            sections={groupSessionsByDay(data).map((group) => ({
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
          />
        )}
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
