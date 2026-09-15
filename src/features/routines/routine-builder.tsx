import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { describeError } from '@/api/errors';
import {
  useCreateRoutine,
  useDeleteRoutine,
  useReorderRoutineTasks,
  useRoutine,
  useRoutineTasks,
  useUpdateRoutine,
} from '@/api/routines.queries';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorPanel } from '@/components/ui/error-panel';
import { FieldLabel } from '@/components/ui/field-label';
import { Input } from '@/components/ui/input';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { ValidationMessage } from '@/components/ui/validation-message';
import { UnsavedChangesDialog } from '@/features/routines/unsaved-changes-dialog';
import { useStartPractice } from '@/features/routines/use-start-practice';
import { useToastStore } from '@/stores/toast-store';
import { TabBarInset } from '@/theme/platform';
import { Colors, MaxContentWidth, Spacing } from '@/theme/tokens';
import type { Routine, RoutineStatus, RoutineTaskWithTask } from '@/types/routine';

/** `CreateRoutineDto` bounds the title at 2–200; a 1-character title is a 400, not a nudge. */
const schema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Give the routine a title before saving.')
    .max(200, 'Keep the title under 200 characters.'),
  notes: z.string().max(2000, 'Keep notes under 2000 characters.'),
});

type FormValues = z.infer<typeof schema>;

const STATUS_SEGMENTS: SegmentedOption<RoutineStatus>[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

/** The action `usePreventRemove` hands back, derived from the hook rather than a guessed export. */
type BlockedAction = Parameters<Parameters<typeof usePreventRemove>[1]>[0]['data']['action'];

/**
 * Canvas 06: one screen creates, views and edits. Create mode fetches nothing, so the two
 * modes split here — before any hook runs — rather than threading an optional id through
 * every query on the screen.
 */
export function RoutineBuilder({ routineId }: { routineId?: string }) {
  return routineId ? <EditRoutine routineId={routineId} /> : <CreateRoutine />;
}

// ---------------------------------------------------------------------------- create

function CreateRoutine() {
  const router = useRouter();
  const createRoutine = useCreateRoutine();
  const [failure, setFailure] = useState<string | null>(null);

  const form = useRoutineForm({ title: '', notes: '' });
  const { guard, releaseTo } = useUnsavedGuard(form.formState.isDirty);

  async function save() {
    setFailure(null);
    const values = form.getValues();
    try {
      const routine = await createRoutine.mutateAsync({
        title: values.title.trim(),
        notes: values.notes.trim() || undefined,
      });
      form.reset(values);
      // `replace`, not `push`: back from the new routine should reach the list, not an
      // empty create form.
      router.replace({ pathname: '/routines/[id]', params: { id: routine.id } });
    } catch (error) {
      setFailure(describeError(error, "Couldn't save this routine").title);
    }
  }

  const submit = form.handleSubmit(save);

  // Saving from the leave prompt navigates to the new routine on its own, so the interrupted
  // back is dropped rather than replayed on top of it.
  const saveAndLeave = form.handleSubmit(async () => {
    guard.keepEditing();
    await save();
  });

  return (
    <Screen>
      <BuilderHeader
        dirty={form.formState.isDirty}
        saving={createRoutine.isPending}
        onBack={() => router.back()}
        onSave={() => void submit()}
      />

      <RoutineFields form={form} disabled={createRoutine.isPending} />

      {failure && <ErrorPanel title={failure} onRetry={() => void submit()} />}

      {/* A routine must exist before tasks can attach — POST /routines/{id}/tasks needs an
          id. Saying so beats rendering a disabled control with no explanation. */}
      <Card quiet>
        <ThemedText type="body" color="textMuted">
          Save the routine first, then add tasks to it.
        </ThemedText>
      </Card>

      <UnsavedChangesDialog
        visible={guard.blocked}
        message="This routine has not been saved yet."
        saving={createRoutine.isPending}
        onSave={() => void saveAndLeave()}
        onDiscard={releaseTo}
        onKeepEditing={guard.keepEditing}
      />
    </Screen>
  );
}

// ------------------------------------------------------------------------------ edit

function EditRoutine({ routineId }: { routineId: string }) {
  const routineQuery = useRoutine(routineId);
  const tasksQuery = useRoutineTasks(routineId);

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

  return (
    <EditRoutineBody routineId={routineId} routine={routineQuery.data} tasks={tasksQuery.data} />
  );
}

function EditRoutineBody({
  routineId,
  routine,
  tasks,
}: {
  routineId: string;
  routine: Routine;
  tasks: RoutineTaskWithTask[];
}) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const startPractice = useStartPractice();

  const updateRoutine = useUpdateRoutine(routineId);
  const deleteRoutine = useDeleteRoutine();
  const reorderMutation = useReorderRoutineTasks(routineId);

  const [status, setStatus] = useState<RoutineStatus>(routine.status);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const form = useRoutineForm({ title: routine.title, notes: routine.notes ?? '' });
  const statusDirty = status !== routine.status;
  const dirty = form.formState.isDirty || statusDirty;
  const { guard, releaseTo } = useUnsavedGuard(dirty);

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

  /** PATCH takes a partial body, so send only what moved. */
  async function save() {
    setFailure(null);
    const values = form.getValues();
    const patch: { title?: string; notes?: string; status?: RoutineStatus } = {};
    if (values.title.trim() !== routine.title) patch.title = values.title.trim();
    if (values.notes.trim() !== (routine.notes ?? '')) patch.notes = values.notes.trim();
    if (statusDirty) patch.status = status;

    try {
      if (Object.keys(patch).length > 0) await updateRoutine.mutateAsync(patch);
      form.reset(values);
      showToast('Routine saved', 'success');
      return true;
    } catch (error) {
      setFailure(describeError(error, "Couldn't save this routine").title);
      return false;
    }
  }

  const submit = form.handleSubmit(save);

  /** Save, then resume the navigation the guard interrupted — but only if the save landed. */
  const saveAndLeave = form.handleSubmit(async () => {
    if (await save()) releaseTo();
  });

  async function archive() {
    setFailure(null);
    try {
      await updateRoutine.mutateAsync({ status: 'archived' });
      setStatus('archived');
      showToast('Routine archived', 'success');
    } catch (error) {
      setFailure(describeError(error, "Couldn't archive this routine").title);
    }
  }

  async function destroy() {
    setConfirmDelete(false);
    setFailure(null);
    try {
      await deleteRoutine.mutateAsync(routineId);
      showToast('Routine deleted', 'success');
      router.replace('/(app)/(main)/(tabs)/routines');
    } catch (error) {
      setFailure(describeError(error, "Couldn't delete this routine").title);
    }
  }

  const busy = updateRoutine.isPending || deleteRoutine.isPending;
  // DELETE /routines/{id} is a 409 while any task is still attached. Rather than cascade —
  // which can strip the tasks and still fail to delete — the action states its precondition.
  const deletable = routine.taskCount === 0;

  return (
    <Screen>
      <BuilderHeader
        dirty={dirty}
        saving={updateRoutine.isPending}
        onBack={() => router.back()}
        onSave={() => void submit()}
      />

      <RoutineFields form={form} disabled={busy} />

      <View style={styles.statusRow}>
        <ThemedText type="overline" color="textMuted">
          Status
        </ThemedText>
        <View style={styles.statusControl}>
          <Segmented options={STATUS_SEGMENTS} value={status} onChange={setStatus} />
        </View>
      </View>

      {failure && <ErrorPanel title={failure} onRetry={() => void submit()} />}

      <View style={styles.summary}>
        <ThemedText type="overline" color="textMuted">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </ThemedText>
        {plannedMinutes > 0 && <ThemedText type="label">{plannedMinutes} min planned</ThemedText>}
      </View>

      {/* Canvas 06b names this state: the reorder lock is per-routine, so a concurrent
          change loses the race and the optimistic order has already rolled back. */}
      {reorderMutation.isError && (
        <ErrorPanel
          title="Order not saved"
          message="Another change was in progress. The list is back to the last saved order."
          onRetry={() => reorderMutation.reset()}
        />
      )}

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
              <Button
                variant="icon"
                accessibilityLabel={`Move ${routineTask.task.title} up`}
                onPress={() => move(index, -1)}
                disabled={index === 0}
              >
                <ChevronUp size={18} strokeWidth={2.75} />
              </Button>
              <Button
                variant="icon"
                accessibilityLabel={`Move ${routineTask.task.title} down`}
                onPress={() => move(index, 1)}
                disabled={index === tasks.length - 1}
              >
                <ChevronDown size={18} strokeWidth={2.75} />
              </Button>
            </View>
          </Card>
        ))}
      </View>

      <Button block onPress={() => startPractice({ id: routineId, title: routine.title }, tasks)}>
        Start Practice
      </Button>

      {/* Canvas 1h: destructive actions go last and never sit beside the confirm action. */}
      <View style={styles.footerActions}>
        <Button
          variant="tertiary"
          style={styles.footerAction}
          disabled={busy}
          onPress={() => void archive()}
        >
          Archive
        </Button>
        <Button
          variant="tertiary"
          style={styles.footerAction}
          disabled={busy || !deletable}
          onPress={() => setConfirmDelete(true)}
        >
          <ThemedText type="label" style={styles.deleteLabel}>
            Delete
          </ThemedText>
        </Button>
      </View>
      {!deletable && (
        <ThemedText type="body" color="textMuted">
          {"Remove this routine's tasks before deleting it."}
        </ThemedText>
      )}

      <ConfirmDialog
        visible={confirmDelete}
        title={`Delete "${routine.title}"?`}
        message="Past sessions that followed it are kept, without the link."
        destructive
        confirmLabel="Delete"
        onConfirm={() => void destroy()}
        onCancel={() => setConfirmDelete(false)}
      />

      <UnsavedChangesDialog
        visible={guard.blocked}
        saving={updateRoutine.isPending}
        onSave={() => void saveAndLeave()}
        onDiscard={releaseTo}
        onKeepEditing={guard.keepEditing}
      />
    </Screen>
  );
}

// ----------------------------------------------------------------------------- shared

function useRoutineForm(defaultValues: FormValues) {
  return useForm<FormValues>({
    resolver: zodResolver(schema),
    // Canvas 01b's rule, applied consistently: validate on blur, per field, never block typing.
    mode: 'onBlur',
    defaultValues,
  });
}

/**
 * Blocks a back/swipe/pop while the form is dirty and hands the attempt back so the screen can
 * ask. `usePreventRemove` fires only when the screen is *removed*, so a web rail tab switch
 * still leaves without prompting — a documented limitation of the hook, not a gap here.
 */
function useUnsavedGuard(dirty: boolean) {
  const navigation = useNavigation();
  const [blockedAction, setBlockedAction] = useState<BlockedAction | null>(null);

  usePreventRemove(dirty, ({ data }) => setBlockedAction(data.action));

  return {
    guard: {
      blocked: blockedAction !== null,
      keepEditing: () => setBlockedAction(null),
    },
    /** Resume the navigation the guard interrupted. */
    releaseTo: () => {
      if (!blockedAction) return;
      setBlockedAction(null);
      navigation.dispatch(blockedAction);
    },
  };
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>{children}</ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function BuilderHeader({
  dirty,
  saving,
  onBack,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.header}>
      <Button variant="icon" accessibilityLabel="Go back" onPress={onBack}>
        <ChevronLeft size={20} strokeWidth={2.75} />
      </Button>
      <View style={styles.spacer} />
      {dirty && <Badge label="Unsaved" />}
      <Button variant="tertiary" loading={saving} loadingLabel="Saving…" onPress={onSave}>
        Save
      </Button>
    </View>
  );
}

function RoutineFields({
  form,
  disabled,
}: {
  form: ReturnType<typeof useRoutineForm>;
  disabled: boolean;
}) {
  const { control, formState } = form;

  return (
    <>
      <View>
        <FieldLabel>Title</FieldLabel>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <Input
              testID="routine-title"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              editable={!disabled}
              invalid={!!formState.errors.title}
              placeholder="Warm-up routine"
            />
          )}
        />
        <ValidationMessage>{formState.errors.title?.message}</ValidationMessage>
      </View>

      <View>
        <FieldLabel>Notes</FieldLabel>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Input
              testID="routine-notes"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              editable={!disabled}
              invalid={!!formState.errors.notes}
              multiline
              placeholder="Fifteen minutes before anything else."
            />
          )}
        />
        <ValidationMessage>{formState.errors.notes?.message}</ValidationMessage>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: MaxContentWidth },
  scroll: { padding: Spacing[4], paddingBottom: TabBarInset + Spacing[4], gap: Spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  spacer: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  statusControl: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskList: { gap: Spacing[3] },
  taskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskInfo: { flex: 1, gap: Spacing[1] },
  index: { width: 14 },
  moveButtons: { flexDirection: 'row', gap: Spacing[1] },
  footerActions: { flexDirection: 'row', gap: Spacing[2] },
  footerAction: { flex: 1 },
  deleteLabel: { color: Colors.dangerRamp[700] },
});
