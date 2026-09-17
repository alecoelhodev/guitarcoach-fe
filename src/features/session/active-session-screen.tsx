import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeError, type ErrorDescription } from '@/api/errors';
import { useCreateSession } from '@/api/sessions.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChecklistRow } from '@/components/ui/checklist-row';
import { FieldLabel } from '@/components/ui/field-label';
import { Input } from '@/components/ui/input';
import { Stepper } from '@/components/ui/stepper';
import { SessionExitDialog } from '@/features/session/session-exit-dialog';
import { type ActiveSessionTask, useActiveSessionStore } from '@/features/session/session-store';
import { formatClock } from '@/lib/duration';
import { useToastStore } from '@/stores/toast-store';
import { Spacing } from '@/theme/tokens';

/**
 * Elapsed is *derived* from `startedAt`, never counted in ticks. Backgrounding the app suspends
 * the interval, so a tick count silently under-reported the session, and a cold start restarted
 * the clock at 00:00 while the persisted tasks survived beside it — the two halves of one
 * session disagreeing. The interval now only forces the re-render.
 *
 * A session persisted before `startedAt` existed rehydrates without one; it reads 0, not `NaN`.
 */
function useStopwatch(startedAt: number | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (startedAt === undefined) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
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
  const {
    routineId,
    routineTitle,
    title,
    notes,
    startedAt,
    tasks,
    setTitle,
    setNotes,
    setTaskMinutes,
    toggleTaskCompleted,
    reset,
  } = useActiveSessionStore();
  const elapsedSeconds = useStopwatch(startedAt);
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
        // Both are optional and both reject the empty string — `title` is `@Length(1, 200)`,
        // and `forbidNonWhitelisted` means a stray '' is a 400 rather than an ignored field.
        // Omit, never blank.
        ...(title?.trim() ? { title: title.trim() } : {}),
        ...(notes?.trim() ? { notes: notes.trim() } : {}),
        tasks: tasks.map((task) => ({
          taskId: task.taskId,
          // 0 is the local "nothing logged" value — a routine task carries no target duration
          // by default — but `CreatePracticeSessionTaskDto.durationMinutes` is `@Min(1)` and
          // that bound does not survive into the generated `api.d.ts`. Sending the zero failed
          // Finish with "tasks.0.durationMinutes must not be less than 1". Minutes are optional
          // by design, so omit the key rather than zeroing it.
          ...(task.durationMinutes >= 1 ? { durationMinutes: task.durationMinutes } : {}),
          completed: task.completed,
        })),
      });
    } catch (error) {
      // Deliberately no `reset()` and no navigation: the minutes exist only here until this
      // write lands, so discarding them on a failed save loses the user's whole session. A
      // banner rather than a toast for the same reason — a message that vanishes after four
      // seconds is one the user can miss while their practice is still unsaved.
      setFailure(describeError(error, "Couldn't save the session"));
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
          {routineTitle && (
            <ThemedText type="body" color="textMuted">
              Following · {routineTitle}
            </ThemedText>
          )}
          <SessionTitle title={title} onChange={setTitle} />
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

        {/* Canvas 2d splits what mobile draws as one "Session notes — optional" card into a
            label and a helper line. Same content, and the label primitive already exists. */}
        <View>
          <FieldLabel>Session notes</FieldLabel>
          <Input
            testID="session-notes"
            value={notes ?? ''}
            onChangeText={setNotes}
            multiline
            // `Input` only sets minHeight: 44, which is one line — a notes box has to ask.
            style={styles.notes}
            placeholder="Optional — what went well, what to fix."
          />
        </View>

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

      <SessionExitDialog
        visible={confirmExit}
        message={describeUnsaved(elapsedSeconds, tasks)}
        saving={createSessionMutation.isPending}
        onFinish={() => {
          setConfirmExit(false);
          void handleFinish();
        }}
        onKeepPracticing={() => setConfirmExit(false)}
        onDiscard={() => {
          setConfirmExit(false);
          handleExit();
        }}
      />
    </ThemedView>
  );
}

/**
 * Canvas 07's title is editable ("Evening practice") but the canvas never draws the control, so
 * this is the lightest thing that reads as the heading it replaces: tap the heading, get an
 * input, commit on blur. An emptied title is legitimate — Finish omits the key rather than
 * sending '', which `@Length(1, 200)` rejects.
 */
function SessionTitle({ title, onChange }: { title?: string; onChange: (title: string) => void }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Rename session"
        onPress={() => setEditing(true)}
      >
        <ThemedText type="h3">{title?.trim() || 'Practice session'}</ThemedText>
      </Pressable>
    );
  }

  return (
    <Input
      testID="session-title"
      autoFocus
      value={title ?? ''}
      onChangeText={onChange}
      onBlur={() => setEditing(false)}
      onSubmitEditing={() => setEditing(false)}
      returnKeyType="done"
      placeholder="Practice session"
    />
  );
}

/** Canvas 07b: "18 minutes and one completed task haven't been saved yet." */
function describeUnsaved(elapsedSeconds: number, tasks: ActiveSessionTask[]) {
  const minutes = Math.floor(elapsedSeconds / 60);
  const completed = tasks.filter((task) => task.completed).length;

  return (
    `${minutes} minute${minutes === 1 ? '' : 's'} and ` +
    `${completed} completed task${completed === 1 ? '' : 's'} haven't been saved yet.`
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing[4], gap: Spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center' },
  clockCard: { alignItems: 'center' },
  note: { textAlign: 'center' },
  notes: { minHeight: 88, paddingTop: Spacing[2], textAlignVertical: 'top' },
  taskList: { gap: Spacing[3] },
  taskCard: { gap: Spacing[3] },
});
