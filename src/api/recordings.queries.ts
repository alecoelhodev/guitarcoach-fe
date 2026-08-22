import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/api/query-keys';
import { listRecordings } from '@/api/recordings';

export function useRecordings(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.recordings(sessionId),
    queryFn: () => listRecordings(sessionId),
  });
}
