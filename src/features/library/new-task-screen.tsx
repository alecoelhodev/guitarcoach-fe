import { useRouter } from 'expo-router';
import { useState } from 'react';

import { describeError, type ErrorDescription } from '@/api/errors';
import { useCreateTask } from '@/api/tasks.queries';
import {
  EMPTY_TASK,
  TaskForm,
  type TaskFormValues,
  toCreateTaskInput,
} from '@/features/library/task-form';
import { useToastStore } from '@/stores/toast-store';

/** Admin-only: the Library shows the entry point to admins, and the backend 403s the rest. */
export function NewTaskScreen() {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const createTask = useCreateTask();
  const [failure, setFailure] = useState<ErrorDescription | null>(null);

  async function submit(values: TaskFormValues) {
    setFailure(null);
    try {
      const task = await createTask.mutateAsync(toCreateTaskInput(values));
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
      defaultValues={EMPTY_TASK}
      pending={createTask.isPending}
      failure={failure}
      onSubmit={submit}
    />
  );
}
