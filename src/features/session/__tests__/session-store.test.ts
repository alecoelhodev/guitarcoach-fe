import { type ActiveSessionTask, useActiveSessionStore } from '@/features/session/session-store';
import { storage } from '@/lib/storage';
import { resetStores } from '@/test/reset-stores';

const PERSIST_KEY = 'active-session';

function task(overrides: Partial<ActiveSessionTask> = {}): ActiveSessionTask {
  return {
    taskId: 'task-1',
    title: 'Alternate picking',
    durationMinutes: 0,
    completed: false,
    ...overrides,
  };
}

const state = () => useActiveSessionStore.getState();

beforeEach(() => {
  resetStores();
});

describe('start', () => {
  it('loads a routine into local state', () => {
    state().start({
      routineId: 'routine-1',
      title: 'Morning warm-up',
      tasks: [task({ taskId: 'a' }), task({ taskId: 'b' })],
    });

    expect(state()).toMatchObject({ routineId: 'routine-1', title: 'Morning warm-up' });
    expect(state().tasks.map((t) => t.taskId)).toEqual(['a', 'b']);
  });

  it('replaces the previous session wholesale rather than merging into it', () => {
    // Starting a second routine discards the first, including its recorded minutes. There
    // is no guard here — the screen is responsible for asking before it calls this.
    state().start({ routineId: 'routine-1', tasks: [task({ taskId: 'a', durationMinutes: 20 })] });
    state().start({ routineId: 'routine-2', tasks: [task({ taskId: 'b' })] });

    expect(state().routineId).toBe('routine-2');
    expect(state().tasks.map((t) => t.taskId)).toEqual(['b']);
  });

  it('supports a blank session with no routine and no title', () => {
    state().start({ tasks: [] });

    expect(state()).toMatchObject({ routineId: undefined, title: undefined, tasks: [] });
  });
});

describe('setTaskMinutes', () => {
  it('records minutes against one task and leaves its siblings alone', () => {
    state().start({ tasks: [task({ taskId: 'a' }), task({ taskId: 'b' })] });

    state().setTaskMinutes('a', 15);

    expect(state().tasks).toEqual([
      expect.objectContaining({ taskId: 'a', durationMinutes: 15 }),
      expect.objectContaining({ taskId: 'b', durationMinutes: 0 }),
    ]);
  });

  it('is a no-op for a task the session does not hold', () => {
    state().start({ tasks: [task({ taskId: 'a' })] });

    state().setTaskMinutes('ghost', 15);

    expect(state().tasks).toEqual([expect.objectContaining({ taskId: 'a', durationMinutes: 0 })]);
  });

  it('does not clamp — the 0..180 range is the Stepper primitive, not the store', () => {
    state().start({ tasks: [task({ taskId: 'a' })] });

    state().setTaskMinutes('a', 9999);

    expect(state().tasks[0].durationMinutes).toBe(9999);
  });
});

describe('toggleTaskCompleted', () => {
  it('flips one task and flips it back', () => {
    state().start({ tasks: [task({ taskId: 'a' })] });

    state().toggleTaskCompleted('a');
    expect(state().tasks[0].completed).toBe(true);

    state().toggleTaskCompleted('a');
    expect(state().tasks[0].completed).toBe(false);
  });

  it('is a no-op for an unknown task', () => {
    state().start({ tasks: [task({ taskId: 'a' })] });

    state().toggleTaskCompleted('ghost');

    expect(state().tasks[0].completed).toBe(false);
  });

  it('preserves recorded minutes while toggling', () => {
    state().start({ tasks: [task({ taskId: 'a', durationMinutes: 12 })] });

    state().toggleTaskCompleted('a');

    expect(state().tasks[0]).toMatchObject({ completed: true, durationMinutes: 12 });
  });
});

describe('reset', () => {
  it('clears the routine, title and tasks', () => {
    state().start({ routineId: 'routine-1', title: 'Morning warm-up', tasks: [task()] });

    state().reset();

    expect(state()).toMatchObject({ routineId: undefined, title: undefined, tasks: [] });
  });
});

describe('persistence', () => {
  it('writes the session to storage so it survives the app being killed', () => {
    state().start({ routineId: 'routine-1', title: 'Morning warm-up', tasks: [task()] });
    state().setTaskMinutes('task-1', 20);

    const persisted = storage.getString(PERSIST_KEY);
    expect(persisted).toBeDefined();
    expect(JSON.parse(persisted as string).state).toMatchObject({
      routineId: 'routine-1',
      title: 'Morning warm-up',
      tasks: [expect.objectContaining({ taskId: 'task-1', durationMinutes: 20 })],
    });
  });

  it('persists an empty session after reset, so a killed app does not resume a stale one', () => {
    state().start({ routineId: 'routine-1', tasks: [task()] });

    state().reset();

    // `routineId` and `title` are absent rather than null: JSON.stringify drops undefined
    // values, so a reset session persists as `{"tasks":[]}`.
    expect(JSON.parse(storage.getString(PERSIST_KEY) as string).state).toEqual({ tasks: [] });
  });

  it('rehydrates a session written by a previous launch', async () => {
    storage.set(
      PERSIST_KEY,
      JSON.stringify({
        version: 0,
        state: { routineId: 'routine-9', title: 'Restored', tasks: [task({ taskId: 'z' })] },
      }),
    );

    await useActiveSessionStore.persist.rehydrate();

    expect(state()).toMatchObject({ routineId: 'routine-9', title: 'Restored' });
    expect(state().tasks.map((t) => t.taskId)).toEqual(['z']);
  });
});
