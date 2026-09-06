import { renderHook, waitFor } from '@testing-library/react-native';

import { instantCreateRoutine, requestPracticePlan, resolvePracticePlan } from '@/api/coach';
import {
  useInstantCreateRoutine,
  useRequestPracticePlan,
  useResolvePracticePlan,
} from '@/api/coach.queries';
import { queryKeys } from '@/api/query-keys';
import { withQueryClient } from '@/test/query-client';
import type { DraftPlanResponse, InstantCreateResponse } from '@/types/coach';

jest.mock('@/api/coach', () => ({
  requestPracticePlan: jest.fn(),
  resolvePracticePlan: jest.fn(),
  instantCreateRoutine: jest.fn(),
}));

const resolveMock = resolvePracticePlan as jest.MockedFunction<typeof resolvePracticePlan>;
const instantMock = instantCreateRoutine as jest.MockedFunction<typeof instantCreateRoutine>;
const requestMock = requestPracticePlan as jest.MockedFunction<typeof requestPracticePlan>;

const created = {
  status: 'created',
  routine: { routineId: 'routine-1', title: 'Morning warm-up', taskCount: 4 },
} satisfies DraftPlanResponse;

const cancelled = { status: 'cancelled' } satisfies DraftPlanResponse;

/** Spying on the client is what distinguishes "invalidated" from "merely succeeded". */
async function setup<T>(hook: () => T) {
  const { queryClient, wrapper } = withQueryClient();
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

  const { result } = await renderHook(hook, { wrapper });
  return { result, invalidate };
}

afterEach(() => jest.resetAllMocks());

describe('useResolvePracticePlan', () => {
  it('invalidates routines once a draft is confirmed into one', async () => {
    resolveMock.mockResolvedValue(created);

    const { result, invalidate } = await setup(() => useResolvePracticePlan());
    result.current.mutate({ previousResponseId: 'resp-1', confirmation: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.routinesRoot });
  });

  it('invalidates nothing when the draft is declined or has expired', async () => {
    // Draft & Review persists nothing until confirmed, so there is no routine list to
    // refetch — and an expired draft returns `cancelled` through the same success path.
    resolveMock.mockResolvedValue(cancelled);

    const { result, invalidate } = await setup(() => useResolvePracticePlan());
    result.current.mutate({ previousResponseId: 'resp-1', confirmation: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('invalidates nothing when the request fails', async () => {
    resolveMock.mockRejectedValue(new Error('offline'));

    const { result, invalidate } = await setup(() => useResolvePracticePlan());
    result.current.mutate({ previousResponseId: 'resp-1', confirmation: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('forwards the draft id and the confirmation to the transport', async () => {
    resolveMock.mockResolvedValue(created);

    const { result } = await setup(() => useResolvePracticePlan());
    result.current.mutate({ previousResponseId: 'resp-7', confirmation: true });

    await waitFor(() => expect(resolveMock).toHaveBeenCalledWith('resp-7', true));
  });
});

describe('useInstantCreateRoutine', () => {
  it('invalidates routines on success, since the routine is already persisted', async () => {
    instantMock.mockResolvedValue({
      message: 'Built you a warm-up.',
      routineId: 'routine-1',
    } satisfies InstantCreateResponse);

    const { result, invalidate } = await setup(() => useInstantCreateRoutine());
    result.current.mutate('build me a warm-up');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.routinesRoot });
  });

  it('invalidates nothing when the request fails', async () => {
    instantMock.mockRejectedValue(new Error('offline'));

    const { result, invalidate } = await setup(() => useInstantCreateRoutine());
    result.current.mutate('build me a warm-up');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useRequestPracticePlan', () => {
  it('returns the draft without invalidating anything, because nothing was written', async () => {
    const awaiting = {
      status: 'awaiting_confirmation',
      previousResponseId: 'resp-1',
      plan: {
        title: 'Morning warm-up',
        summary: 'Chromatic runs then chords.',
        totalDurationMinutes: 30,
        requiresConfirmation: true,
        tasks: [{ title: 'Chromatics', description: '4 frets', durationMinutes: 10 }],
      },
    } satisfies DraftPlanResponse;
    requestMock.mockResolvedValue(awaiting);

    const { result, invalidate } = await setup(() => useRequestPracticePlan());
    result.current.mutate('build me a warm-up');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(awaiting);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
