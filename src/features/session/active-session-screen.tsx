import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCreateSession } from '@/api/sessions.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChecklistRow } from '@/components/ui/checklist-row';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Stepper } from '@/components/ui/stepper';
import { useActiveSessionStore } from '@/features/session/session-store';
import { formatClock } from '@/lib/duration';
import { useToastStore } from '@/stores/toast-store';
import { Spacing } from '@/theme/tokens';

function useStopwatch() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds;
}

export function ActiveSessionScreen() {
  const router = useRouter();
  const { routineId, title, tasks, setTaskMinutes, toggleTaskCompleted, reset } =
    useActiveSessionStore();
  const elapsedSeconds = useStopwatch();
  // Canvas 07: the clock is a local pacing aid; what gets saved is the per-task
  // minutes. "Planned" is the sum of the routine's target durations.
  const plannedMinutes = tasks.reduce((sum, task) => sum + (task.targetDurationMinutes ?? 0), 0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [startedWithNoTasks] = useState(() => tasks.length === 0);
  const createSessionMutation = useCreateSession();
  const showToast = useToastStore((state) => state.show);

  async function handleFinish() {
    await createSessionMutation.mutateAsync({
      routineId,
      title,
      tasks: tasks.map((t) => ({
        taskId: t.taskId,
        durationMinutes: t.durationMinutes,
        completed: t.completed,
      })),
    });
    reset();
    router.back();
    showToast('Session saved', 'success');
  }

  function handleExit() {
    reset();
    router.back();
  }

  if (startedWithNoTasks) {
    // Navigated here directly without starting from a routine — nothing to practice.
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="h5">No active session</ThemedText>
          <Button variant="secondary" onPress={() => router.back()}>
            Go back
          </Button>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Button
            variant="icon"
            accessibilityLabel="Exit practice"
            onPress={() => setConfirmExit(true)}
          >
            <X size={20} strokeWidth={2.75} />
          </Button>
        </View>

        <View>
          {title && (
            <ThemedText type="body" color="textMuted">
              Following · {title}
            </ThemedText>
          )}
          <ThemedText type="h3">{title ?? 'Practice session'}</ThemedText>
        </View>

        <Card style={styles.clockCard}>
          <ThemedText type="overline" color="textMuted">
            Elapsed · on this device
          </ThemedText>
          <ThemedText type="display">{formatClock(elapsedSeconds)}</ThemedText>
          {plannedMinutes > 0 && (
            <ThemedText type="body" color="textMuted">
              of {plannedMinutes} min planned
            </ThemedText>
          )}
        </Card>

        <ThemedText type="overline" color="textMuted">
          Routine tasks
        </ThemedText>

        <ScrollView contentContainerStyle={styles.taskList}>
          {tasks.map((task) => (
            <Card key={task.taskId} style={styles.taskCard}>
              <ChecklistRow
                label={task.title}
                checked={task.completed}
                onToggle={() => toggleTaskCompleted(task.taskId)}
              />
              <Stepper
                minutes={task.durationMinutes}
                onChange={(m) => setTaskMinutes(task.taskId, m)}
              />
            </Card>
          ))}
        </ScrollView>

        <Button
          block
          loading={createSessionMutation.isPending}
          loadingLabel="Saving session…"
          onPress={handleFinish}
        >
          Finish Session
        </Button>

        <ThemedText type="body" color="textMuted" style={styles.note}>
          Saved when you finish.
        </ThemedText>
      </SafeAreaView>

      <ConfirmDialog
        visible={confirmExit}
        title="Exit practice?"
        message="Nothing is saved until you finish. Exiting now discards this session."
        destructive
        confirmLabel="Exit"
        cancelLabel="Keep practicing"
        onConfirm={() => {
          setConfirmExit(false);
          handleExit();
        }}
        onCancel={() => setConfirmExit(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing[4], gap: Spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center' },
  clockCard: { alignItems: 'center' },
  note: { textAlign: 'center' },
  taskList: { gap: Spacing[3] },
  taskCard: { gap: Spacing[3] },
});
