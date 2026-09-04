import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Link } from 'expo-router';

import { useRoutines } from '@/api/routines.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { RoutineCard } from '@/features/routines/routine-card';
import { TabBarInset } from '@/theme/platform';
import { MaxContentWidth, Spacing } from '@/theme/tokens';

export function RoutinesList() {
  const query = useRoutines();
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const routines = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3" style={styles.title}>
          Routines
        </ThemedText>

        <QueryState
          query={query}
          errorTitle="Couldn't load routines"
          isEmpty={routines.length === 0}
          empty={
            <EmptyState
              title="No routines yet"
              message="Ask the AI Coach to build your first one."
            />
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
                      empty state — routines have no other creation path today. */}
                  <Link href="/(app)/(main)/coach" asChild>
                    <Button variant="ghost" block>
                      Ask AI Coach to draft one
                    </Button>
                  </Link>
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
  list: { padding: Spacing[4], paddingBottom: TabBarInset + Spacing[4], gap: Spacing[3] },
  footer: { alignItems: 'center' },
  footerBlock: { gap: Spacing[3] },
});
