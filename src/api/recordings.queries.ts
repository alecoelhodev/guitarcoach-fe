import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UploadFile } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import { deleteRecording, listRecordings, uploadRecording } from '@/api/recordings';

export function useRecordings(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.recordings(sessionId),
    queryFn: () => listRecordings(sessionId),
  });
}

/**
 * Deliberately thin — picking the file and rejecting an oversized or wrong-typed one is the
 * screen's job (`src/lib/file-validation.ts`), not the hook's, so a caller cannot get a
 * silently-skipped upload that still resolves.
 */
export function useUploadRecording(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: UploadFile) => uploadRecording(sessionId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings(sessionId) });
    },
  });
}

/** `sessionId` is for the cache key only; the endpoint itself is keyed by `recordingId`. */
export function useDeleteRecording(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordingId: string) => deleteRecording(recordingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings(sessionId) });
    },
  });
}
