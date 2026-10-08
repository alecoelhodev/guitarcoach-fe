import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeError, type ErrorDescription } from '@/api/errors';
import { useTask, useUpdateTask } from '@/api/tasks.queries';
import { ThemedView } from '@/components/themed-view';
import { QueryState } from '@/components/ui/query-state';
import { TaskForm, type TaskFormValues } from '@/features/library/task-form';
import { useToastStore } from '@/stores/toast-store';
import { MaxContentWidth, Spacing } from '@/theme/tokens';
import type { Task, UpdateTaskInput } from '@/types/task';

/** Admin-only: the detail screen shows the entry point to admins, and the backend 403s the rest. */
export function EditTaskScreen({ taskId }: { taskId: string }) {
  const query = useTask(taskId);

  if (query.data) return <EditTaskForm task={query.data} />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <QueryState query={query} errorTitle="Couldn't load this task">
          {() => null}
        </QueryState>
      </SafeAreaView>
    </ThemedView>
  );
}

function EditTaskForm({ task }: { task: Task }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const updateTask = useUpdateTask(task.id);
  const [failure, setFailure] = useState<ErrorDescription | null>(null);

  async function submit(values: TaskFormValues) {
    const patch = toPatch(values, task);
    if (Object.keys(patch).length === 0) {
      router.back();
      return;
    }
    setFailure(null);
    try {
      await updateTask.mutateAsync(patch);
      router.back();
      showToast('Task updated', 'success');
    } catch (error) {
      setFailure(describeError(error, "Couldn't save this task"));
    }
  }

  return (
    <TaskForm
      heading="Edit task"
      defaultValues={{
        title: task.title,
        description: task.description ?? '',
        referenceLink: task.referenceLink ?? '',
        category: task.category ?? undefined,
        difficulty: task.difficulty ?? undefined,
      }}
      pending={updateTask.isPending}
      failure={failure}
      onSubmit={submit}
    />
  );
}

/** Sends only what changed, so a save never rewrites a field another admin just edited. */
function toPatch(values: TaskFormValues, task: Task): UpdateTaskInput {
  const patch: UpdateTaskInput = {};
  const title = values.title.trim();
  const description = values.description.trim();
  if (title !== task.title) patch.title = title;
  // `null` clears a saved value; the form holds "unset" as undefined (chips) or '' (link).
  if (values.category !== (task.category ?? undefined)) patch.category = values.category ?? null;
  if (values.difficulty !== (task.difficulty ?? undefined))
    patch.difficulty = values.difficulty ?? null;
  if (description !== (task.description ?? '')) patch.description = description;
  if (values.referenceLink !== (task.referenceLink ?? ''))
    patch.referenceLink = values.referenceLink || null;
  return patch;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing[4],
  },
});
