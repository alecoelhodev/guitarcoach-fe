import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeError, type ErrorDescription } from '@/api/errors';
import { useCreateSession } from '@/api/sessions.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Banner } from '@/components/ui/banner';
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

/**
 * `persist` rehydrates AsyncStorage asynchronously, so the store is still empty on the first
 * render. The body below latches `startedWithNoTasks` from that first render, so it has to
 * mount only once hydration has finished — otherwise a session restored from disk always
 * renders as "No active session".
 */
export function ActiveSessionScreen() {
  const [hydrated, setHydrated] = useState(() => useActiveSessionStore.persist.hasHydrated());

  useEffect(
    // Subscribed rather than set from the effect body, which the React Compiler's
    // `set-state-in-effect` rule forbids. Returns its own unsubscribe.
    () => useActiveSessionStore.persist.onFinishHydration(() => setHydrated(true)),
    [],
  );

  if (!hydrated) return null;

  return <ActiveSessionScreenBody />;
}

function ActiveSessionScreenBody() {
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
  const [failure, setFailure] = useState<ErrorDescription | null>(null);

  async function handleFinish() {
    setFailure(null);
    try {
      await createSessionMutation.mutateAsync({
        routineId,
        title,
        tasks: tasks.map((task) => ({
          taskId: task.taskId,
          // `CreatePracticeSessionTaskDto.durationMinutes` is `@Min(1)` on the backend and
          // that bound does not survive into the generated `api.d.ts`, so sending the 0 a
          // task starts at is a 400. Minutes are optional by design — omit, don't zero.
          ...(task.durationMinutes >= 1 ? { durationMinutes: task.durationMinutes } : {}),
          completed: task.completed,
        })),
      });
    } catch (error) {
      // Deliberately no `reset()` and no navigation: the minutes exist only here until this
      // write lands, so discarding them on a failed save loses the user's whole session.
      setFailure(describeError(error, "Couldn't save this session"));
      return;
    }

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

        {failure && <Banner tone="error" title={failure.title} message={failure.message} />}

        <Button
          block
          loading={createSessionMutation.isPending}
          loadingLabel="Saving session…"
          onPress={() => void handleFinish()}
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
