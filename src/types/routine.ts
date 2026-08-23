import type { components } from '@/types/api';

export type Routine = components['schemas']['RoutineResponseDto'];
export type RoutineStatus = Routine['status'];

export type RoutineTask = components['schemas']['RoutineTaskResponseDto'];
export type RoutineTaskWithTask = components['schemas']['RoutineTaskWithTaskResponseDto'];
