import type { Paginated } from '@/types/pagination';
import type { Recording } from '@/types/recording';
import type { Routine, RoutineTaskWithTask } from '@/types/routine';
import type { PracticeSession, PracticeSessionTask } from '@/types/session';
import type { Task } from '@/types/task';
import type { User } from '@/types/user';

/**
 * Fixtures for the generated API shapes. Every builder takes a partial override so a suite
 * can vary the one field it cares about without restating the whole DTO — which is what
 * made the `user` object drift into two copies before this file existed.
 *
 * Dates are fixed strings, never `new Date()`, so a test asserting on a formatted date
 * cannot start failing tomorrow.
 */

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'jordan@example.com',
    emailVerified: true,
    name: 'Jordan',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Alternate picking',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: 'routine-1',
    userId: 'u1',
    title: 'Morning warm-up',
    status: 'active',
    taskCount: 0,
    totalTargetDurationMinutes: 0,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

/** What `useRoutineTasks` returns: the join row with its task expanded. */
export function makeRoutineTaskWithTask(
  overrides: Partial<RoutineTaskWithTask> = {},
): RoutineTaskWithTask {
  return {
    routineId: 'routine-1',
    taskId: 'task-1',
    position: 1,
    targetDurationMinutes: null,
    task: makeTask(),
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function makeSessionTask(overrides: Partial<PracticeSessionTask> = {}): PracticeSessionTask {
  return {
    practiceSessionId: 'session-1',
    taskId: 'task-1',
    completed: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function makeSession(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    id: 'session-1',
    userId: 'u1',
    sessionTasks: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

export function makeRecording(overrides: Partial<Recording> = {}): Recording {
  return {
    id: 'recording-1',
    userId: 'u1',
    practiceSessionId: 'session-1',
    objectName: 'recordings/recording-1.m4a',
    originalFileName: 'take-1.m4a',
    contentType: 'audio/x-m4a',
    sizeBytes: 1_048_576,
    createdAt: TIMESTAMP,
    ...overrides,
  };
}

/**
 * A single page of a paginated list. `page`/`totalPages` are the two fields every
 * `getNextPageParam` in `src/api` reads, so they default to a one-page result and tests
 * override them to describe the boundary they are asserting.
 */
export function makePage<T>(data: T[], meta: Partial<Paginated<T>['meta']> = {}): Paginated<T> {
  return {
    data,
    meta: { total: data.length, page: 1, limit: 20, totalPages: 1, ...meta },
  };
}
