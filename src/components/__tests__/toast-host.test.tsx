import { act, render, screen } from '@testing-library/react-native';

import { ToastHost } from '@/components/toast-host';
import { useToastStore } from '@/stores/toast-store';

/**
 * The auto-dismiss lives here rather than in the store, so this is the only place it can be
 * tested. Fake timers throughout — with real ones the 4000 ms window outlives the test and
 * the `hide` lands after teardown.
 */

const AUTO_DISMISS_MS = 4000;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('ToastHost', () => {
  it('renders nothing while there is no toast', async () => {
    await render(<ToastHost />);

    expect(screen.toJSON()).toBeNull();
  });

  it('shows a toast that the store puts up', async () => {
    await render(<ToastHost />);

    await act(async () => {
      useToastStore.getState().show('Session saved', 'success');
    });

    expect(screen.getByText('Session saved')).toBeTruthy();
  });

  it('dismisses itself after four seconds, and not before', async () => {
    await render(<ToastHost />);
    await act(async () => {
      useToastStore.getState().show('Session saved');
    });

    await advance(AUTO_DISMISS_MS - 1);
    expect(screen.getByText('Session saved')).toBeTruthy();

    await advance(1);
    expect(screen.queryByText('Session saved')).toBeNull();
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('restarts the countdown when a second toast replaces the first', async () => {
    await render(<ToastHost />);
    await act(async () => {
      useToastStore.getState().show('First');
    });

    await advance(3000);
    await act(async () => {
      useToastStore.getState().show('Second');
    });

    // 3000 ms into the first toast's window, so the old timer would fire here if the effect
    // did not clear it on re-run.
    await advance(1500);
    expect(screen.getByText('Second')).toBeTruthy();

    await advance(2500);
    expect(screen.queryByText('Second')).toBeNull();
  });

  it('clears its timer on unmount instead of hiding a toast it no longer owns', async () => {
    const view = await render(<ToastHost />);
    await act(async () => {
      useToastStore.getState().show('Session saved');
    });

    await view.unmount();
    await advance(AUTO_DISMISS_MS * 2);

    // Asserted through the store rather than a timer count, because unmounting schedules
    // timers of React's own: if the effect's `clearTimeout` had not run, the pending `hide`
    // would have fired by now and nulled this.
    expect(useToastStore.getState().toast).toMatchObject({ message: 'Session saved' });
  });
});
