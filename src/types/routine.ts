import type { Task } from '@/types/task';

export type RoutineStatus = 'active' | 'archived';

export type Routine = {
  id: string;
  userId: string;
  title: string;
  status: RoutineStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RoutineTask = {
  routineId: string;
  taskId: string;
  position: number;
  targetDurationMinutes?: number | null;
};

export type RoutineTaskWithTask = RoutineTask & { task: Task };
