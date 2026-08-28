import type { components } from '@/types/api';

export type PracticePlanTask = components['schemas']['PracticePlanTaskResponseDto'];
export type PracticePlan = components['schemas']['PracticePlanResponseDto'];

export type DraftPlanResponse =
  | components['schemas']['AwaitingConfirmationResponseDto']
  | components['schemas']['PlanCreatedResponseDto']
  | components['schemas']['PlanCancelledResponseDto'];

export type InstantCreateResponse = components['schemas']['RoutineCoachResponseDto'];
