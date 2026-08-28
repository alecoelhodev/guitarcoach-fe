import type { components } from '@/types/api';

export type Task = components['schemas']['TaskResponseDto'];
export type TaskCategory = NonNullable<Task['category']>;
export type TaskDifficulty = NonNullable<Task['difficulty']>;
