import type { components } from '@/types/api';

export type Task = components['schemas']['TaskResponseDto'];
export type CreateTaskInput = components['schemas']['CreateTaskDto'];
export type UpdateTaskInput = components['schemas']['UpdateTaskDto'];
export type TaskDraft = components['schemas']['TaskDraftDto'];
export type TaskGeneratorInput = components['schemas']['TaskGeneratorRequestDto'];
export type TaskGeneratorResponse = components['schemas']['TaskGeneratorResponseDto'];
export type TaskCategory = NonNullable<Task['category']>;
export type TaskDifficulty = NonNullable<Task['difficulty']>;
