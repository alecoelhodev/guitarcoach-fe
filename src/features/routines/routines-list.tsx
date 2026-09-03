import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRoutines } from '@/api/routines.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryState } from '@/components/ui/query-state';
import { RoutineCard } from '@/features/routines/routine-card';
import { MaxContentWidth, Spacing, TabBarInset } from '@/theme/tokens';

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
                hasNextPage ? (
                  <Button
                    variant="secondary"
                    loading={isFetchingNextPage}
                    onPress={() => fetchNextPage()}
                  >
                    Load more
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
  list: { padding: Spacing[4], paddingBottom: TabBarInset + Spacing[4], gap: Spacing[3] },
});
