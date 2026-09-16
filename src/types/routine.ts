import type { components } from '@/types/api';

export type Routine = components['schemas']['RoutineResponseDto'];
export type RoutineStatus = Routine['status'];

export type RoutineTask = components['schemas']['RoutineTaskResponseDto'];
export type RoutineTaskWithTask = components['schemas']['RoutineTaskWithTaskResponseDto'];

export type CreateRoutineInput = components['schemas']['CreateRoutineDto'];
export type UpdateRoutineInput = components['schemas']['UpdateRoutineDto'];
export type AddRoutineTaskInput = components['schemas']['AddRoutineTaskDto'];
export type UpdateRoutineTaskInput = components['schemas']['UpdateRoutineTaskDto'];
