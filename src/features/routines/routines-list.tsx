import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRoutines } from '@/api/routines.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { RoutineCard } from '@/features/routines/routine-card';
import { TabBarInset } from '@/theme/platform';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import type { RoutineStatus } from '@/types/routine';

const SEGMENTS: SegmentedOption<RoutineStatus>[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

/**
 * The Archived segment is not a nicety. A scheduled backend job archives every routine still
 * active from before the current week, so without a way to see them routines simply vanish
 * and the app reads as broken.
 */
export function RoutinesList() {
  // Local state on purpose: the route is a tab, and expo-router's typed routes carry no query
  // param for it. Nothing here is worth persisting across launches.
  const [status, setStatus] = useState<RoutineStatus>('active');

  const query = useRoutines({ status });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const routines = query.data?.pages.flatMap((page) => page.data) ?? [];
  const archived = status === 'archived';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3" style={styles.title}>
          Routines
        </ThemedText>

        <View style={styles.segment}>
          <Segmented options={SEGMENTS} value={status} onChange={setStatus} />
        </View>

        <QueryState
          query={query}
          errorTitle="Couldn't load your routines"
          isEmpty={routines.length === 0}
          empty={
            archived ? (
              <EmptyState title="Nothing archived yet." />
            ) : (
              <EmptyState
                title="No routines yet"
                message="Build one from the library or ask the coach."
              />
            )
          }
        >
          {() => (
            <FlatList
              data={routines}
              keyExtractor={(routine) => routine.id}
              renderItem={({ item }) => <RoutineCard routine={item} />}
              contentContainerStyle={styles.list}
              ListFooterComponent={
                <>
                  {hasNextPage && (
                    <View style={styles.footer}>
                      <Button
                        variant="tertiary"
                        disabled={isFetchingNextPage}
                        onPress={() => fetchNextPage()}
                      >
                        {isFetchingNextPage ? 'Loading…' : 'Load more'}
                      </Button>
                    </View>
                  )}
                  {/* Canvas 05 keeps the coach reachable from the list, not just the
                      empty state — routines have no other creation path today. Creating
                      from the Archived tab would land the user back on Active with no
                      explanation, so the tab offers nothing. */}
                  {!archived && (
                    <>
                      <Link href="/(app)/(main)/coach" asChild>
                        <Button variant="ghost" block>
                          Ask AI Coach to draft one
                        </Button>
                      </Link>
                      {/* Canvas 05 places Create Routine under the coach button. */}
                      <Link href="/routines/new" asChild>
                        <Button variant="secondary" block>
                          Create Routine
                        </Button>
                      </Link>
                    </>
                  )}
                </>
              }
              ListFooterComponentStyle={styles.footerBlock}
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
  segment: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[3] },
  list: { padding: Spacing[4], paddingBottom: TabBarInset + Spacing[4], gap: Spacing[3] },
  footer: { alignItems: 'center' },
  footerBlock: { gap: Spacing[3] },
});
