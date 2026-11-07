import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { describeError, type ErrorDescription } from '@/api/errors';
import { useAddRoutineTask, useInvalidateRoutines } from '@/api/routines.queries';
import { useCreateTask } from '@/api/tasks.queries';
import {
  EMPTY_TASK,
  TaskForm,
  type TaskFormValues,
  toCreateTaskInput,
} from '@/features/library/task-form';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';

/**
 * Creates a task and appends it to the routine. Anyone may: an admin's task joins the Library,
 * anyone else's is private to them, which the backend decides from the role.
 */
export function RoutineNewTaskScreen({ routineId }: { routineId: string }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const isAdmin = useSessionStore((state) => state.user?.role === 'admin');
  const createTask = useCreateTask();
  const addRoutineTask = useAddRoutineTask(routineId);
  const invalidateRoutines = useInvalidateRoutines();
  const [failure, setFailure] = useState<ErrorDescription | null>(null);
  // Two writes, not one: if the add fails after the create landed, Save retries only the add,
  // so a retry never creates the task twice.
  const createdId = useRef<string | undefined>(undefined);

  async function submit(values: TaskFormValues) {
    setFailure(null);
    try {
      createdId.current ??= (await createTask.mutateAsync(toCreateTaskInput(values))).id;
    } catch (error) {
      setFailure(describeError(error, "Couldn't save this task"));
      return;
    }
    try {
      await addRoutineTask.mutateAsync({ taskId: createdId.current });
    } catch (error) {
      const { title, message } = describeError(error, "Couldn't add the task to this routine");
      setFailure({ title, message: `The task was saved. ${message ?? 'Try again.'}` });
      return;
    }
    void invalidateRoutines();
    showToast('Task added', 'success');
    router.back();
  }

  return (
    <TaskForm
      heading="New task"
      note={
        isAdmin
          ? 'It is added to this routine and to the Library.'
          : 'It is added to this routine. Only you can see it.'
      }
      defaultValues={EMPTY_TASK}
      pending={createTask.isPending || addRoutineTask.isPending}
      failure={failure}
      onSubmit={submit}
    />
  );
}
