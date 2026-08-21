import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listRoutines } from '@/api/routines';
import { queryKeys } from '@/api/query-keys';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorPanel } from '@/components/ui/error-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { RoutineCard } from '@/features/routines/routine-card';
import { MaxContentWidth, Spacing, TabBarInset } from '@/theme/tokens';

export function RoutinesList() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.routines(),
    queryFn: () => listRoutines(),
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="h3" style={styles.title}>
          Routines
        </ThemedText>

        {isPending ? (
          <Skeleton height={80} />
        ) : isError ? (
          <ErrorPanel title="Couldn't load routines" onRetry={refetch} />
        ) : data.data.length === 0 ? (
          <EmptyState title="No routines yet" message="Ask the AI Coach to build your first one." />
        ) : (
          <FlatList
            data={data.data}
            keyExtractor={(routine) => routine.id}
            renderItem={({ item }) => <RoutineCard routine={item} />}
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
  list: { padding: Spacing[4], paddingBottom: TabBarInset + Spacing[4], gap: Spacing[3] },
});
