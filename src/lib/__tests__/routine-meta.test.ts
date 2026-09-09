import { formatRoutineMeta } from '@/lib/routine-meta';

describe('formatRoutineMeta', () => {
  it('renders the canvas label', () => {
    expect(formatRoutineMeta({ taskCount: 4, totalTargetDurationMinutes: 45 })).toBe(
      '4 tasks · 45 min',
    );
  });

  it('singularises a lone task', () => {
    expect(formatRoutineMeta({ taskCount: 1, totalTargetDurationMinutes: 45 })).toBe(
      '1 task · 45 min',
    );
  });

  it('says "0 tasks" for an empty routine rather than an empty string', () => {
    expect(formatRoutineMeta({ taskCount: 0, totalTargetDurationMinutes: 0 })).toBe('0 tasks');
  });

  // Target durations are optional per routine task, so this is a real state, not an edge case.
  it('drops the duration half when no task carries a target', () => {
    expect(formatRoutineMeta({ taskCount: 3, totalTargetDurationMinutes: 0 })).toBe('3 tasks');
  });

  it('defers to formatMinutes past an hour', () => {
    expect(formatRoutineMeta({ taskCount: 6, totalTargetDurationMinutes: 75 })).toBe(
      '6 tasks · 1h 15m',
    );
  });
});
