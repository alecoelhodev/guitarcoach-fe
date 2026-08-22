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
import { useToastStore } from '@/stores/toast-store';
import { Spacing } from '@/theme/tokens';

function useStopwatch() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ActiveSessionScreen() {
  const router = useRouter();
  const { routineId, title, tasks, setTaskMinutes, toggleTaskCompleted, reset } =
    useActiveSessionStore();
  const elapsed = useStopwatch();
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
          <Button variant="icon" onPress={() => setConfirmExit(true)}>
            <X size={20} strokeWidth={2.75} />
          </Button>
          <ThemedText type="h4">{elapsed}</ThemedText>
          <View style={{ width: 36 }} />
        </View>

        <ThemedText type="h5">{title ?? 'Practice session'}</ThemedText>

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

        <Button block loading={createSessionMutation.isPending} onPress={handleFinish}>
          Finish
        </Button>
      </SafeAreaView>

      <ConfirmDialog
        visible={confirmExit}
        title="Exit practice?"
        message="Nothing is saved until you finish. Exiting now discards this session."
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskList: { gap: Spacing[3] },
  taskCard: { gap: Spacing[3] },
});
