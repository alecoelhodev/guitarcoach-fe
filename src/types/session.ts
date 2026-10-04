import type { components } from '@/types/api';

export type PracticeSessionTask = components['schemas']['PracticeSessionTaskResponseDto'];
export type PracticeSessionTaskSummary =
  components['schemas']['PracticeSessionTaskSummaryResponseDto'];
export type PracticeSession = components['schemas']['PracticeSessionResponseDto'];

export type CreateSessionInput = components['schemas']['CreatePracticeSessionDto'];
