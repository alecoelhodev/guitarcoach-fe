jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));
jest.mock('@/api/routines.queries', () => ({ useRoutines: jest.fn() }));
// Its own suite covers seeding the session and navigating against a real QueryClient; the
// sheet only has to hand it the routine the user picked.
jest.mock('@/features/session/use-start-practice', () => ({ useStartPractice: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { useRoutines } from '@/api/routines.queries';
import { Button } from '@/components/ui/button';
import {
  PracticeSheetProvider,
  usePracticeSheet,
} from '@/features/session/practice-sheet-provider';
import { useActiveSessionStore } from '@/features/session/session-store';
import { useStartPractice } from '@/features/session/use-start-practice';
import { mockRouter } from '@/test/expo-router';
import { makePage, makeRoutine } from '@/test/fixtures';
import { infinitePages, mutationStub, pendingInfinite } from '@/test/query-hooks';

/**
 * `@gorhom/bottom-sheet/mock` renders its children unconditionally, present/dismiss or not —
 * so "the sheet is closed" can never be asserted through the modal itself. `Sheet` gates its
 * own content on `visible` and the provider mounts the sheet only while open, which is what
 * makes the absence assertions below mean anything.
 */

const useRoutinesMock = useRoutines as jest.MockedFunction<typeof useRoutines>;
const useStartPracticeMock = useStartPractice as jest.MockedFunction<typeof useStartPractice>;

type AnyHook = jest.MockedFunction<(...args: never[]) => unknown>;

let startPractice: ReturnType<typeof mutationStub>;

const ROUTINES = [
  makeRoutine({ id: 'r1', title: 'Morning warm-up', taskCount: 4, totalTargetDurationMinutes: 45 }),
  makeRoutine({
    id: 'r2',
    title: 'Fingerstyle focus',
    taskCount: 2,
    totalTargetDurationMinutes: 0,
  }),
];

/** The provider is the component under test as much as the sheet — it owns open/closed. */
function renderShell() {
  return render(
    <PracticeSheetProvider>
      <OpenButton />
    </PracticeSheetProvider>,
  );
}

function OpenButton() {
  const sheet = usePracticeSheet();
  return <Button onPress={sheet.open}>Practice</Button>;
}

beforeEach(() => {
  jest.clearAllMocks();
  startPractice = mutationStub();
  (useStartPracticeMock as unknown as AnyHook).mockReturnValue(startPractice);
  (useRoutinesMock as unknown as AnyHook).mockReturnValue(infinitePages([makePage(ROUTINES)]));
});

it('stays shut until the practice action is pressed', async () => {
  await renderShell();

  expect(screen.queryByText('Start a blank session')).toBeNull();

  await fireEvent.press(screen.getByText('Practice'));

  expect(screen.getByText('Start practice')).toBeTruthy();
  expect(screen.getByText('Start a blank session')).toBeTruthy();
});

it('lists active routines with their task count and planned minutes', async () => {
  await renderShell();
  await fireEvent.press(screen.getByText('Practice'));

  expect(screen.getByText('Morning warm-up')).toBeTruthy();
  expect(screen.getByText('4 tasks · 45 min')).toBeTruthy();
  // A routine whose tasks carry no targets totals zero — "2 tasks · 0 min" would read as a bug.
  expect(screen.getByText('2 tasks')).toBeTruthy();
});

it('asks for active routines only, since an archived one has nowhere to go', async () => {
  await renderShell();
  await fireEvent.press(screen.getByText('Practice'));

  expect(useRoutinesMock).toHaveBeenCalledWith({ status: 'active' });
});

it('starts the picked routine and closes, without a second navigation', async () => {
  await renderShell();
  await fireEvent.press(screen.getByText('Practice'));

  await fireEvent.press(screen.getByLabelText('Morning warm-up'));

  expect(startPractice.mutate).toHaveBeenCalledWith({ routine: ROUTINES[0] });
  expect(screen.queryByText('Start a blank session')).toBeNull();
});

/**
 * The backend allows a session with no routine and no tasks — `routineId` and `tasks` are both
 * optional on `CreatePracticeSessionDto` — and Home has been advertising this with an inert
 * card since before it existed.
 */
it('opens a blank session with no routine attached', async () => {
  await renderShell();
  await fireEvent.press(screen.getByText('Practice'));

  await fireEvent.press(screen.getByText('Start a blank session'));

  expect(useActiveSessionStore.getState()).toMatchObject({
    routineId: undefined,
    routineTitle: undefined,
    tasks: [],
  });
  expect(mockRouter.push).toHaveBeenCalledWith('/session/active');
});

it('offers the blank session even while the routines are still loading', async () => {
  (useRoutinesMock as unknown as AnyHook).mockReturnValue(pendingInfinite());
  await renderShell();

  await fireEvent.press(screen.getByText('Practice'));

  expect(screen.getByText('Start a blank session')).toBeTruthy();
});

it('points a user with no active routines at the blank session', async () => {
  (useRoutinesMock as unknown as AnyHook).mockReturnValue(infinitePages([makePage([])]));
  await renderShell();

  await fireEvent.press(screen.getByText('Practice'));

  expect(screen.getByText('No active routines')).toBeTruthy();
  expect(screen.getByText('Start a blank session')).toBeTruthy();
});
