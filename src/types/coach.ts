export type PracticePlanTask = {
  title: string;
  description: string;
  durationMinutes: number;
};

export type PracticePlan = {
  title: string;
  summary: string;
  totalDurationMinutes: number;
  tasks: PracticePlanTask[];
  requiresConfirmation: boolean;
};

export type DraftPlanResponse =
  | { status: 'awaiting_confirmation'; plan: PracticePlan; previousResponseId: string }
  | { status: 'created'; routine: { routineId: string; title: string; taskCount: number } }
  | { status: 'cancelled' };

export type InstantCreateResponse = {
  message: string;
  routineId?: string;
  routineTitle?: string;
  taskCount?: number;
};
