import { queryKeys } from '@/api/query-keys';

describe('queryKeys', () => {
  /**
   * `sessions` (infinite) and `sessionsSummary` (standard) once produced the identical key
   * for the same limit, which makes TanStack throw on the mismatched query type the moment
   * both mount. Guarding the discriminator that fixed it.
   */
  it('keeps list, summary and detail keys distinct', () => {
    const keys = [
      queryKeys.sessions({ limit: 100 }),
      queryKeys.sessionsSummary(100),
      queryKeys.session('100'),
      queryKeys.tasks({ limit: 100 }),
      queryKeys.task('100'),
      queryKeys.routines({ limit: 100 }),
      queryKeys.routine('100'),
    ].map((key) => JSON.stringify(key));

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('nests every key under its root so prefix invalidation still matches', () => {
    expect(queryKeys.sessions({}).slice(0, 1)).toEqual(queryKeys.sessionsRoot);
    expect(queryKeys.sessionsSummary(1).slice(0, 1)).toEqual(queryKeys.sessionsRoot);
    expect(queryKeys.session('a').slice(0, 1)).toEqual(queryKeys.sessionsRoot);
    expect(queryKeys.recordings('a').slice(0, 1)).toEqual(queryKeys.sessionsRoot);
    expect(queryKeys.routineTasks('a').slice(0, 1)).toEqual(queryKeys.routinesRoot);
  });
});
