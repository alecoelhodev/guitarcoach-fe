jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/api/coach.queries', () => ({
  useInstantCreateRoutine: jest.fn(),
  useRequestPracticePlan: jest.fn(),
  useResolvePracticePlan: jest.fn(),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import {
  useInstantCreateRoutine,
  useRequestPracticePlan,
  useResolvePracticePlan,
} from '@/api/coach.queries';
import { CoachScreen } from '@/features/coach/coach-screen';
import { mockRouter } from '@/test/expo-router';
import { mutationStub } from '@/test/query-hooks';

/**
 * The densest branching in the app: two modes, three mutations and a draft that only exists
 * between two of them. Draft & Review persists nothing until confirmed; Instant Create writes
 * on success — so the tests care most about which endpoint each press reaches and what the
 * screen says afterwards.
 */

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

const requestPlan = useRequestPracticePlan as unknown as AnyHook;
const resolvePlan = useResolvePracticePlan as unknown as AnyHook;
const instantCreate = useInstantCreateRoutine as unknown as AnyHook;

const PROMPT = 'e.g. 30 minutes of jazz comping basics';

const DRAFT = {
  status: 'awaiting_confirmation',
  previousResponseId: 'resp-1',
  plan: {
    title: 'Blues warm-up',
    summary: 'Shuffle feel and turnarounds.',
    totalDurationMinutes: 30,
    tasks: [{ title: 'Shuffle rhythm', durationMinutes: 30 }],
  },
};

// Typed loosely on purpose: TypeScript otherwise infers each parameter's type from its own
// default, so passing a `{ status: 'created' }` response where the default was the draft shape
// is rejected. These stand in for TanStack results the screen only reads a few fields of.
type Stub = ReturnType<typeof mutationStub> & { isPending?: boolean };

function stubs({
  request = mutationStub(DRAFT) as Stub,
  resolve = mutationStub() as Stub,
  instant = mutationStub() as Stub,
}: {
  request?: Stub;
  resolve?: Stub;
  instant?: Stub;
} = {}) {
  requestPlan.mockReturnValue(request);
  resolvePlan.mockReturnValue(resolve);
  instantCreate.mockReturnValue(instant);
  return { request, resolve, instant };
}

async function submit(text: string) {
  await fireEvent.changeText(screen.getByPlaceholderText(PROMPT), text);
  await act(async () => {
    await fireEvent.press(screen.getByText('Draft a plan'));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  stubs();
});

describe('mode switching', () => {
  it('opens in Draft & Review and says nothing is saved yet', async () => {
    await render(<CoachScreen />);

    expect(
      screen.getByText('Create a practice plan and review it before anything is saved.'),
    ).toBeTruthy();
    expect(screen.getByText('Draft a plan')).toBeTruthy();
    expect(screen.queryByText('Saves straight away')).toBeNull();
  });

  it('warns before the composer in Instant Create, which writes without confirming', async () => {
    await render(<CoachScreen />);

    await fireEvent.press(screen.getByText('Instant Create'));

    expect(screen.getByText('Saves straight away')).toBeTruthy();
    expect(screen.getByText('Create routine')).toBeTruthy();
    expect(screen.queryByText('Draft a plan')).toBeNull();
  });

  it('offers different starting points per mode', async () => {
    await render(<CoachScreen />);
    expect(screen.getByText('30-min blues routine')).toBeTruthy();
    expect(screen.queryByText('45 min, no repeats')).toBeNull();

    await fireEvent.press(screen.getByText('Instant Create'));

    expect(screen.getByText('45 min, no repeats')).toBeTruthy();
    expect(screen.queryByText('30-min blues routine')).toBeNull();
  });

  it('fills the composer from a suggestion chip', async () => {
    await render(<CoachScreen />);

    await fireEvent.press(screen.getByText('Fix my barre chords'));

    expect(screen.getByPlaceholderText(PROMPT).props.value).toBe('Fix my barre chords');
  });

  it('clears a pending draft when the mode changes', async () => {
    await render(<CoachScreen />);
    await submit('30-min blues routine');
    expect(screen.getByText('Draft plan')).toBeTruthy();

    await fireEvent.press(screen.getByText('Instant Create'));

    expect(screen.queryByText('Draft plan')).toBeNull();
  });
});

describe('submitting', () => {
  it('does nothing at all for blank or whitespace-only input', async () => {
    const { request } = stubs();
    await render(<CoachScreen />);

    await act(async () => {
      await fireEvent.press(screen.getByText('Draft a plan'));
    });
    await submit('   ');

    expect(request.mutateAsync).not.toHaveBeenCalled();
  });

  it('trims the prompt before sending it', async () => {
    const { request } = stubs();
    await render(<CoachScreen />);

    await submit('  30-min blues  ');

    expect(request.mutateAsync).toHaveBeenCalledWith('30-min blues');
  });

  it('shows the draft for review without saving anything', async () => {
    await render(<CoachScreen />);

    await submit('30-min blues routine');

    expect(screen.getByText('Not saved')).toBeTruthy();
    expect(screen.getByText('Blues warm-up')).toBeTruthy();
    expect(screen.getByText('Save Routine')).toBeTruthy();
  });

  it('reports a routine the planner created outright, and clears the composer', async () => {
    stubs({
      request: mutationStub({ status: 'created', routine: { title: 'Blues warm-up' } }),
    });
    await render(<CoachScreen />);

    await submit('30-min blues routine');

    expect(screen.getByText('Routine "Blues warm-up" created.')).toBeTruthy();
    expect(screen.getByPlaceholderText(PROMPT).props.value).toBe('');
    expect(screen.queryByText('Save Routine')).toBeNull();
  });

  it('disables the submit button while any of the three mutations is in flight', async () => {
    const request = { ...mutationStub(DRAFT), isPending: true };
    stubs({ request });
    await render(<CoachScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText(PROMPT), 'anything');
    await act(async () => {
      await fireEvent.press(screen.getByText('Draft a plan'));
    });

    expect(request.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('instant create', () => {
  async function submitInstant(text: string) {
    await fireEvent.press(screen.getByText('Instant Create'));
    await fireEvent.changeText(screen.getByPlaceholderText(PROMPT), text);
    await act(async () => {
      await fireEvent.press(screen.getByText('Create routine'));
    });
  }

  it('goes to the other endpoint and reports the server message', async () => {
    const { instant, request } = stubs({
      instant: mutationStub({ message: 'Created "Evening theory".', routineId: 'r1' }),
    });
    await render(<CoachScreen />);

    await submitInstant("what I've skipped lately");

    expect(instant.mutateAsync).toHaveBeenCalledWith("what I've skipped lately");
    expect(request.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('Created "Evening theory".')).toBeTruthy();
  });

  it('keeps the prompt when the coach declined to create anything', async () => {
    stubs({
      instant: mutationStub({ message: "I couldn't find enough recent practice." }),
    });
    await render(<CoachScreen />);

    await submitInstant('too vague');

    expect(screen.getByText("I couldn't find enough recent practice.")).toBeTruthy();
    // No `routineId`, so nothing was written and the prompt is left to be edited.
    expect(screen.getByPlaceholderText(PROMPT).props.value).toBe('too vague');
  });
});

describe('resolving a draft', () => {
  it('saves a confirmed plan and offers a way to see it', async () => {
    const { resolve } = stubs({
      resolve: mutationStub({ status: 'created', routine: { title: 'Blues warm-up' } }),
    });
    await render(<CoachScreen />);
    await submit('30-min blues routine');

    await act(async () => {
      await fireEvent.press(screen.getByText('Save Routine'));
    });

    expect(resolve.mutateAsync).toHaveBeenCalledWith({
      previousResponseId: 'resp-1',
      confirmation: true,
    });
    expect(screen.getByText('Routine "Blues warm-up" created.')).toBeTruthy();
    expect(screen.queryByText('Not saved')).toBeNull();

    await fireEvent.press(screen.getByText('View routines'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/(main)/(tabs)/routines');
  });

  it('sends confirmation: false on discard and says the plan was declined', async () => {
    const { resolve } = stubs({ resolve: mutationStub({ status: 'cancelled' }) });
    await render(<CoachScreen />);
    await submit('30-min blues routine');

    await act(async () => {
      await fireEvent.press(screen.getByText('Discard'));
    });

    expect(resolve.mutateAsync).toHaveBeenCalledWith({
      previousResponseId: 'resp-1',
      confirmation: false,
    });
    expect(screen.getByText('Plan declined.')).toBeTruthy();
  });

  it('treats an expired draft the same as a decline, since the API returns cancelled', async () => {
    const { resolve } = stubs({ resolve: mutationStub({ status: 'cancelled' }) });
    await render(<CoachScreen />);
    await submit('30-min blues routine');

    await act(async () => {
      await fireEvent.press(screen.getByText('Save Routine'));
    });

    expect(resolve.mutateAsync).toHaveBeenCalledWith({
      previousResponseId: 'resp-1',
      confirmation: true,
    });
    expect(screen.getByText('Plan declined.')).toBeTruthy();
    expect(screen.queryByText('Not saved')).toBeNull();
  });
});
