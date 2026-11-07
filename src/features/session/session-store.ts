import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { discardClipFile } from '@/features/recordings/pending-clip-files';
import { storage } from '@/lib/storage';

export type ActiveSessionTask = {
  taskId: string;
  title: string;
  targetDurationMinutes?: number;
  durationMinutes: number;
  completed: boolean;
};

/**
 * A recording made or picked during the session. There is no session id to upload it to until
 * Finish, so it waits on the device (`pending-clip-files.ts`) and uploads right after the save.
 */
export type PendingClip = {
  id: string;
  name: string;
  mimeType: string;
  uri: string;
  seconds?: number;
};

type ResumeInput = {
  userId?: string;
  sessionId: string;
  routineId?: string;
  title?: string;
  notes?: string;
  tasks: ActiveSessionTask[];
  elapsedSeconds: number;
};

type ActiveSessionState = {
  /**
   * Who started this session. The store is persisted under one device-wide key, so without an
   * owner a session left behind by a signed-out account is offered to whoever signs in next —
   * routine, minutes and unsaved notes included. Checked wherever the session is surfaced;
   * `clearLocalSession` is the proactive half of the same guard.
   */
  userId?: string;
  /** The saved session being resumed. Finish updates it rather than writing a new one. */
  sessionId?: string;
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
  clips: PendingClip[];
  start: (input: {
    userId?: string;
    routineId?: string;
    routineTitle?: string;
    title?: string;
    tasks: ActiveSessionTask[];
  }) => void;
  /** Reopens a saved session; the clock carries on from `elapsedSeconds`. */
  resume: (input: ResumeInput) => void;
  setTitle: (title: string) => void;
  setNotes: (notes: string) => void;
  setTaskMinutes: (taskId: string, minutes: number) => void;
  toggleTaskCompleted: (taskId: string) => void;
  addClip: (clip: PendingClip) => void;
  /** Also deletes the clip's file. */
  removeClip: (id: string) => void;
  /** Also deletes every pending clip's file — a reset session has nothing left to upload. */
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
    (set, get) => ({
      tasks: [],
      clips: [],

      start: ({ userId, routineId, routineTitle, title, tasks }) =>
        set({
          userId,
          sessionId: undefined,
          routineId,
          routineTitle,
          title,
          tasks,
          clips: [],
          notes: undefined,
          startedAt: Date.now(),
        }),

      // The clock is derived from `startedAt`, so backdating it is all it takes to carry on.
      resume: ({ elapsedSeconds, ...session }) => {
        for (const clip of get().clips) discardClipFile(clip.id, clip.uri);
        set({
          ...session,
          routineTitle: undefined,
          clips: [],
          startedAt: Date.now() - elapsedSeconds * 1000,
        });
      },

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

      addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),

      removeClip: (id) => {
        const clip = get().clips.find((candidate) => candidate.id === id);
        if (clip) discardClipFile(clip.id, clip.uri);
        set((state) => ({ clips: state.clips.filter((candidate) => candidate.id !== id) }));
      },

      // Every field clears to `undefined`, never to '' or 0: `JSON.stringify` drops undefined,
      // so a reset session persists as `{"tasks":[]}` and a killed app resumes nothing.
      reset: () => {
        for (const clip of get().clips) discardClipFile(clip.id, clip.uri);
        set({
          userId: undefined,
          sessionId: undefined,
          routineId: undefined,
          routineTitle: undefined,
          title: undefined,
          notes: undefined,
          startedAt: undefined,
          tasks: [],
          clips: [],
        });
      },
    }),
    {
      name: 'active-session',
      storage: createJSONStorage(() => storage),
      version: 2,
      // v0 predates `userId`, so a session stored then has no owner and cannot be proved to
      // belong to whoever is signed in now. Dropped rather than adopted. v1 only lacks `clips`,
      // which the initial state supplies when the two merge.
      migrate: (persisted, version) =>
        (version >= 1 ? persisted : { tasks: [] }) as ActiveSessionState,
      // A web clip is a `blob:` URL that dies with the tab, so persisting it would resume a
      // session with clips that can no longer be read.
      partialize: (state) => (process.env.EXPO_OS === 'web' ? { ...state, clips: [] } : state),
    },
  ),
);
