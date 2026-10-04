import { useRouter } from 'expo-router';
import X from 'lucide-react-native/icons/x';
import { useEffect, useRef, useState } from 'react';
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
import { KeyboardAwareScreen } from '@/components/ui/keyboard-aware-screen';
import { Stepper } from '@/components/ui/stepper';
import { SessionExitDialog } from '@/features/session/session-exit-dialog';
import { type ActiveSessionTask, useActiveSessionStore } from '@/features/session/session-store';
import { formatClock } from '@/lib/duration';
import { succeeded } from '@/lib/haptics';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';
import { Colors, IconSize, IconStroke, Spacing } from '@/theme/tokens';

/**
 * Elapsed is *derived* from `startedAt`, never counted in ticks. Backgrounding the app suspends
 * the interval, so a tick count silently under-reported the session, and a cold start restarted
 * the clock at 00:00 while the persisted tasks survived beside it — the two halves of one
 * session disagreeing. The interval now only forces the re-render.
 *
 * A session persisted before `startedAt` existed rehydrates without one; it reads 0, not `NaN`.
 */
function elapsedSecondsAt(startedAt: number | undefined, now: number) {
  if (startedAt === undefined) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/**
 * Owns the tick.
 *
 * The interval used to live in the screen body, which re-rendered the whole session once a
 * second — every task card, its checkbox, its minutes stepper, and the notes field the user
 * was typing into — to advance one line of text. The exit dialog is the only other reader and
 * it needs the elapsed time once, when it opens, not sixty times a minute.
 */
function SessionClock({ startedAt }: { startedAt: number | undefined }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <ThemedText type="display">{formatClock(elapsedSecondsAt(startedAt, now))}</ThemedText>;
}

/** Long enough to span a burst of typing, short enough that a killed app loses half a second. */
const DRAFT_COMMIT_MS = 500;

/**
 * A text field's local copy of a persisted store value.
 *
 * `persist` serialises the whole session to AsyncStorage on every `set()`, so binding the
 * input straight to the store rewrote that JSON once per keystroke. The draft commits on blur,
 * after `DRAFT_COMMIT_MS` without typing, on unmount, and whenever a caller `flush()`es.
 *
 * `commit` must be stable (module scope): the unmount effect depends on it, and a new identity
 * per render would flush on every keystroke and undo the whole point.
 */
function useDraft(initial: string | undefined, commit: (text: string) => void) {
  const [value, setValue] = useState(initial ?? '');
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function flush() {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    commit(pending.current);
    pending.current = null;
  }

  function onChangeText(text: string) {
    setValue(text);
    pending.current = text;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DRAFT_COMMIT_MS);
  }

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current !== null) commit(pending.current);
    },
    [commit],
  );

  return { value, onChangeText, flush };
}

// A draft that lands after the session is gone — discarded, finished, or reset by sign-out —
// would write one field back into an emptied store, and with it a previous user's notes.
function commitTitle(title: string) {
  const state = useActiveSessionStore.getState();
  if (state.tasks.length > 0) state.setTitle(title);
}

function commitNotes(notes: string) {
  const state = useActiveSessionStore.getState();
  if (state.tasks.length > 0) state.setNotes(notes);
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

/** A `fullScreenModal` covers the status bar and the home indicator, so it owns both. */
const MODAL_EDGES = ['top', 'bottom'] as const;

function ActiveSessionScreenBody() {
  const router = useRouter();
  // Sliced, not `useActiveSessionStore()`. Subscribing to the whole store object meant any
  // `set()` — a minute stepped, a box ticked — re-rendered everything below.
  const userId = useActiveSessionStore((state) => state.userId);
  const routineId = useActiveSessionStore((state) => state.routineId);
  const routineTitle = useActiveSessionStore((state) => state.routineTitle);
  const title = useActiveSessionStore((state) => state.title);
  const notes = useActiveSessionStore((state) => state.notes);
  const startedAt = useActiveSessionStore((state) => state.startedAt);
  const tasks = useActiveSessionStore((state) => state.tasks);
  // Initialised once, which is safe only because the hydration gate mounts this body after the
  // store has settled — the store is the draft's source exactly once, then the draft leads.
  const titleDraft = useDraft(title, commitTitle);
  const notesDraft = useDraft(notes, commitNotes);
  const setTaskMinutes = useActiveSessionStore((state) => state.setTaskMinutes);
  const toggleTaskCompleted = useActiveSessionStore((state) => state.toggleTaskCompleted);
  const reset = useActiveSessionStore((state) => state.reset);
  // Canvas 07: the clock is a local pacing aid; what gets saved is the per-task
  // minutes. "Planned" is the sum of the routine's target durations.
  const plannedMinutes = tasks.reduce((sum, task) => sum + (task.targetDurationMinutes ?? 0), 0);
  const [confirmExit, setConfirmExit] = useState(false);
  const signedInUserId = useSessionStore((state) => state.user?.id);
  const createSessionMutation = useCreateSession();
  const showToast = useToastStore((state) => state.show);
  const [failure, setFailure] = useState<ErrorDescription | null>(null);

  async function handleFinish() {
    setFailure(null);
    // Read from the drafts, which are never behind; flushed so a failed save keeps the text.
    const finalTitle = titleDraft.value.trim();
    const finalNotes = notesDraft.value.trim();
    titleDraft.flush();
    notesDraft.flush();
    try {
      await createSessionMutation.mutateAsync({
        routineId,
        // Both are optional and both reject the empty string — `title` is `@Length(1, 200)`,
        // and `forbidNonWhitelisted` means a stray '' is a 400 rather than an ignored field.
        // Omit, never blank.
        ...(finalTitle ? { title: finalTitle } : {}),
        ...(finalNotes ? { notes: finalNotes } : {}),
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
    leave();
    succeeded();
    showToast('Session saved', 'success');
  }

  function handleExit() {
    reset();
    leave();
  }

  /**
   * This route is a `fullScreenModal` that is always pushed, so `back()` is normally right —
   * but a web reload or a deep link onto it leaves nothing to pop, and `back()` is then a
   * no-op that stranded the user on a session that had just been reset: a 0:00 clock, no
   * tasks, and a live Finish button that would POST an empty session.
   */
  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(main)/(tabs)');
  }

  // Derived, not latched at mount: the hydration gate above guarantees the store has settled
  // before this body renders, and a latch left the screen showing a live session after
  // `reset()` had already emptied it. An owner mismatch counts as no session — the store is
  // persisted under one device-wide key, so it can outlive the account that wrote it.
  if (tasks.length === 0 || userId !== signedInUserId) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={MODAL_EDGES}>
          <ThemedText type="h5">No active session</ThemedText>
          <Button variant="secondary" onPress={leave}>
            Go back
          </Button>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={MODAL_EDGES}>
        <KeyboardAwareScreen>
          <View style={styles.header}>
            <Button
              variant="icon"
              accessibilityLabel="Exit practice"
              onPress={() => setConfirmExit(true)}
            >
              <X color={Colors.text} size={IconSize.lg} strokeWidth={IconStroke} />
            </Button>
          </View>

          <View>
            {routineTitle && (
              <ThemedText type="body" color="textMuted">
                Following · {routineTitle}
              </ThemedText>
            )}
            <SessionTitle
              title={titleDraft.value}
              onChange={titleDraft.onChangeText}
              onCommit={titleDraft.flush}
            />
          </View>

          <Card style={styles.clockCard}>
            <ThemedText type="overline" color="textMuted">
              Elapsed · on this device
            </ThemedText>
            <SessionClock startedAt={startedAt} />
            {plannedMinutes > 0 && (
              <ThemedText type="body" color="textMuted">
                of {plannedMinutes} min planned
              </ThemedText>
            )}
          </Card>

          <ThemedText type="overline" color="textMuted">
            Routine tasks
          </ThemedText>

          <ScrollView contentContainerStyle={styles.taskList} keyboardShouldPersistTaps="handled">
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
              value={notesDraft.value}
              onChangeText={notesDraft.onChangeText}
              onBlur={notesDraft.flush}
              multiline
              // `Input` only sets minHeight: 44, which is one line — a notes box has to ask.
              style={styles.notes}
              placeholder="Optional — what went well, what to fix."
              autoCapitalize="sentences"
              maxLength={2000}
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
        </KeyboardAwareScreen>
      </SafeAreaView>

      <SessionExitDialog
        visible={confirmExit}
        // Read once, at render, rather than from a value that ticks: the dialog only needs
        // to say roughly how much practice is at stake.
        message={describeUnsaved(elapsedSecondsAt(startedAt, Date.now()), tasks)}
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
function SessionTitle({
  title,
  onChange,
  onCommit,
}: {
  title: string;
  onChange: (title: string) => void;
  onCommit: () => void;
}) {
  const [editing, setEditing] = useState(false);

  function finishEditing() {
    onCommit();
    setEditing(false);
  }

  if (!editing) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Rename session"
        onPress={() => setEditing(true)}
      >
        <ThemedText type="h3">{title.trim() || 'Practice session'}</ThemedText>
      </Pressable>
    );
  }

  return (
    <Input
      testID="session-title"
      autoFocus
      value={title}
      onChangeText={onChange}
      onBlur={finishEditing}
      onSubmitEditing={finishEditing}
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
  // Grew with the type scale: `Input` only guarantees one line, and a notes box asks for
  // about four.
  notes: { minHeight: 108, paddingTop: Spacing[2], textAlignVertical: 'top' },
  taskList: { gap: Spacing[3] },
  taskCard: { gap: Spacing[3] },
});
