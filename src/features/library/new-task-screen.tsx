import { useRouter } from 'expo-router';
import { useState } from 'react';

import { describeError, type ErrorDescription } from '@/api/errors';
import { useCreateTask } from '@/api/tasks.queries';
import { TaskForm, type TaskFormValues } from '@/features/library/task-form';
import { useToastStore } from '@/stores/toast-store';

const EMPTY: TaskFormValues = { title: '', description: '', referenceLink: '' };

/** Admin-only: the Library shows the entry point to admins, and the backend 403s the rest. */
export function NewTaskScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const createTask = useCreateTask();
  const [failure, setFailure] = useState<ErrorDescription | null>(null);

  async function submit(values: TaskFormValues) {
    setFailure(null);
    try {
      const task = await createTask.mutateAsync({
        title: values.title.trim(),
        category: values.category,
        difficulty: values.difficulty,
        description: values.description.trim() || undefined,
        referenceLink: values.referenceLink || undefined,
      });
      // `replace`: back from the new task should reach the Library, not an emptied form.
      router.replace({ pathname: '/library/[id]', params: { id: task.id } });
      showToast('Task created', 'success');
    } catch (error) {
      setFailure(describeError(error, "Couldn't save this task"));
    }
  }

  return (
    <TaskForm
      heading="New task"
      defaultValues={EMPTY}
      pending={createTask.isPending}
      failure={failure}
      onSubmit={submit}
    />
  );
}
