import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mmkvStorage } from '@/lib/storage';

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
 * Starting practice loads a routine's tasks into local state, persisted to MMKV so
 * an in-progress session survives the app being backgrounded and killed. The
 * session record itself is still written once, on Finish (plan/SETUP-PLAN.md
 * "API constraints") — persistence here only protects against losing that local
 * progress, not against the write itself.
 */
export const useActiveSessionStore = create<ActiveSessionState>()(
  persist(
    (set) => ({
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
    }),
    { name: 'active-session', storage: createJSONStorage(() => mmkvStorage) },
  ),
);
