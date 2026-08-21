import { create } from 'zustand';

export type ActiveSessionTask = {
  taskId: string;
  title: string;
  targetDurationMinutes?: number;
  durationMinutes: number;
  completed: boolean;
};

type ActiveSessionState = {
  routineId?: string;
  title?: string;
  tasks: ActiveSessionTask[];
  start: (input: { routineId?: string; title?: string; tasks: ActiveSessionTask[] }) => void;
  setTaskMinutes: (taskId: string, minutes: number) => void;
  toggleTaskCompleted: (taskId: string) => void;
  reset: () => void;
};

/**
 * Starting practice loads a routine's tasks into local state only — the session
 * is written once, on Finish. Backing out costs nothing (plan/SETUP-PLAN.md
 * "API constraints").
 */
export const useActiveSessionStore = create<ActiveSessionState>((set) => ({
  tasks: [],

  start: ({ routineId, title, tasks }) => set({ routineId, title, tasks }),

  setTaskMinutes: (taskId, durationMinutes) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.taskId === taskId ? { ...task, durationMinutes } : task,
      ),
    })),

  toggleTaskCompleted: (taskId) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.taskId === taskId ? { ...task, completed: !task.completed } : task,
      ),
    })),

  reset: () => set({ routineId: undefined, title: undefined, tasks: [] }),
}));
