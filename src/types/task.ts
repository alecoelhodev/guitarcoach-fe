import type { components } from '@/types/api';

export type Task = components['schemas']['TaskResponseDto'];
export type CreateTaskInput = components['schemas']['CreateTaskDto'];
export type TaskCategory = NonNullable<Task['category']>;
export type TaskDifficulty = NonNullable<Task['difficulty']>;
