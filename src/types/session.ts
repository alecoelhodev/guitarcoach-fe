export type PracticeSessionTask = {
  taskId: string;
  durationMinutes?: number | null;
  completed: boolean;
};

export type PracticeSession = {
  id: string;
  userId: string;
  routineId?: string | null;
  title?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  sessionTasks?: PracticeSessionTask[];
};
