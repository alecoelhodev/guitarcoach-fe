import { useMutation, useQueryClient } from '@tanstack/react-query';

import { instantCreateRoutine, requestPracticePlan, resolvePracticePlan } from '@/api/coach';

export function useRequestPracticePlan() {
  return useMutation({ mutationFn: (prompt: string) => requestPracticePlan(prompt) });
}

/** Draft & Review writes nothing until confirmed — only invalidate routines once created. */
export function useResolvePracticePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      previousResponseId,
      confirmation,
    }: {
      previousResponseId: string;
      confirmation: boolean;
    }) => resolvePracticePlan(previousResponseId, confirmation),
    onSuccess: (response) => {
      if (response.status === 'created') {
        queryClient.invalidateQueries({ queryKey: ['routines'] });
      }
    },
  });
}

/** Instant Create persists server-side on success. */
export function useInstantCreateRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => instantCreateRoutine(message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
    },
  });
}
