import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeError } from '@/api/errors';
import { useReorderRoutineTasks, useRoutine, useRoutineTasks } from '@/api/routines.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorPanel } from '@/components/ui/error-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveSessionStore } from '@/features/session/session-store';
import { TabBarInset } from '@/theme/platform';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import type { RoutineTaskWithTask } from '@/types/routine';

export function RoutineDetail({ routineId }: { routineId: string }) {
  const router = useRouter();
  const startSession = useActiveSessionStore((state) => state.start);

  const routineQuery = useRoutine(routineId);
  const tasksQuery = useRoutineTasks(routineId);
  const reorderMutation = useReorderRoutineTasks(routineId);

  if (routineQuery.isPending || tasksQuery.isPending) {
    return (
      <Card>
        <Skeleton width="70%" />
        <Skeleton width="45%" />
      </Card>
    );
  }
  if (routineQuery.isError || tasksQuery.isError) {
    const { title, message } = describeError(
      routineQuery.error ?? tasksQuery.error,
      "Couldn't load this routine",
    );
    return (
      <ErrorPanel
        title={title}
        message={message}
        onRetry={() => {
          routineQuery.refetch();
          tasksQuery.refetch();
        }}
      />
    );
  }

  const routine = routineQuery.data;
  const tasks = tasksQuery.data;
  const plannedMinutes = tasks.reduce(
    (sum: number, task: RoutineTaskWithTask) => sum + (task.targetDurationMinutes ?? 0),
    0,
  );

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= tasks.length) return;
    const reordered = [...tasks];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderMutation.mutate(reordered.map((t) => t.taskId));
  }

  function handleStartPractice() {
    startSession({
      routineId,
      title: routine.title,
      tasks: tasks.map((t: RoutineTaskWithTask) => ({
        taskId: t.taskId,
        title: t.task.title,
        targetDurationMinutes: t.targetDurationMinutes ?? undefined,
        durationMinutes: t.targetDurationMinutes ?? 0,
        completed: false,
      })),
    });
    router.push('/session/active');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="h3">{routine.title}</ThemedText>

          {routine.notes && (
            <Card quiet>
              <ThemedText type="body" color="textMuted">
                {routine.notes}
              </ThemedText>
            </Card>
          )}

          <View style={styles.summary}>
            <ThemedText type="overline" color="textMuted">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </ThemedText>
            {plannedMinutes > 0 && (
              <ThemedText type="label">{plannedMinutes} min planned</ThemedText>
            )}
          </View>

          <View style={styles.taskList}>
            {tasks.map((routineTask: RoutineTaskWithTask, index: number) => (
              <Card key={routineTask.taskId} style={styles.taskRow}>
                <ThemedText type="body" color="textMuted" style={styles.index}>
                  {index + 1}
                </ThemedText>
                <View style={styles.taskInfo}>
                  <ThemedText type="label">{routineTask.task.title}</ThemedText>
                  {routineTask.targetDurationMinutes != null && (
                    <ThemedText type="body" color="textMuted">
                      {routineTask.targetDurationMinutes} min
                    </ThemedText>
                  )}
                </View>
                <View style={styles.moveButtons}>
                  <Button variant="icon" onPress={() => move(index, -1)} disabled={index === 0}>
                    <ChevronUp size={18} strokeWidth={2.75} />
                  </Button>
                  <Button
                    variant="icon"
                    onPress={() => move(index, 1)}
                    disabled={index === tasks.length - 1}
                  >
                    <ChevronDown size={18} strokeWidth={2.75} />
                  </Button>
                </View>
              </Card>
            ))}
          </View>

          <Button block onPress={handleStartPractice}>
            Start Practice
          </Button>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  scroll: { padding: Spacing[4], paddingBottom: TabBarInset + Spacing[4], gap: Spacing[4] },
  taskList: { gap: Spacing[3] },
  taskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskInfo: { flex: 1, gap: Spacing[1] },
  index: { width: 14 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moveButtons: { flexDirection: 'row', gap: Spacing[1] },
});
