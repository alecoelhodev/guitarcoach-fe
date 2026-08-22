export const queryKeys = {
  authSession: ['auth', 'session'] as const,
  me: ['auth', 'me'] as const,

  tasks: (query?: Record<string, unknown>) => ['tasks', query] as const,
  task: (id: string) => ['tasks', id] as const,

  routines: (query?: Record<string, unknown>) => ['routines', query] as const,
  routine: (id: string) => ['routines', id] as const,
  routineTasks: (routineId: string) => ['routines', routineId, 'tasks'] as const,

  sessions: (query?: Record<string, unknown>) => ['sessions', query] as const,
  session: (id: string) => ['sessions', id] as const,

  recordings: (sessionId: string) => ['sessions', sessionId, 'recordings'] as const,
  recordingDownloadUrl: (recordingId: string) =>
    ['recordings', recordingId, 'download-url'] as const,
};
