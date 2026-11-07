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

/**
 * Uploads the clips held during a practice session, once Finish has given it an id. One at a
 * time so a long session can't open a dozen 50 MB uploads at once. Resolves to how many failed:
 * the session is already saved, so a failed clip must not fail — and invite a retry of — Finish.
 */
export function useUploadSessionClips() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, files }: { sessionId: string; files: UploadFile[] }) => {
      let failed = 0;
      for (const file of files) {
        try {
          await uploadRecording(sessionId, file);
        } catch {
          failed += 1;
        }
      }
      return failed;
    },
    onSettled: (_failed, _error, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recordings(sessionId) });
    },
  });
}
