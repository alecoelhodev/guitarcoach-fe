import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/lib/storage';

export type ActiveSessionTask = {
  taskId: string;
  title: string;
  targetDurationMinutes?: number;
  durationMinutes: number;
  completed: boolean;
};

type ActiveSessionState = {
  routineId?: string;
  /**
   * The routine being followed, kept separate from `title`. Canvas 07 shows both — "Following ·
   * Warm-up routine" above an editable "Evening practice" — and the moment the user renames the
   * session the two stop agreeing, so one field cannot serve both.
   */
  routineTitle?: string;
  title?: string;
  notes?: string;
  /**
   * Epoch ms, stamped once when the session starts. The clock is derived from it rather than
   * counted in ticks, so backgrounding the app — which suspends the interval — no longer
   * restarts practice at 00:00 while the tasks survive beside it.
   */
  startedAt?: number;
  tasks: ActiveSessionTask[];
  start: (input: {
    routineId?: string;
    routineTitle?: string;
    title?: string;
    tasks: ActiveSessionTask[];
  }) => void;
  setTitle: (title: string) => void;
  setNotes: (notes: string) => void;
  setTaskMinutes: (taskId: string, minutes: number) => void;
  toggleTaskCompleted: (taskId: string) => void;
  reset: () => void;
};

/**
 * Starting practice loads a routine's tasks into local state, persisted to AsyncStorage so
 * an in-progress session survives the app being backgrounded and killed. The
 * session record itself is still written once, on Finish (plan/SETUP-PLAN.md
 * "API constraints") — persistence here only protects against losing that local
 * progress, not against the write itself.
 */
export const useActiveSessionStore = create<ActiveSessionState>()(
  persist(
    (set) => ({
      tasks: [],

      start: ({ routineId, routineTitle, title, tasks }) =>
        set({ routineId, routineTitle, title, tasks, notes: undefined, startedAt: Date.now() }),

      setTitle: (title) => set({ title }),

      setNotes: (notes) => set({ notes }),

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

      // Every field clears to `undefined`, never to '' or 0: `JSON.stringify` drops undefined,
      // so a reset session persists as `{"tasks":[]}` and a killed app resumes nothing.
      reset: () =>
        set({
          routineId: undefined,
          routineTitle: undefined,
          title: undefined,
          notes: undefined,
          startedAt: undefined,
          tasks: [],
        }),
    }),
    { name: 'active-session', storage: createJSONStorage(() => storage) },
  ),
);
