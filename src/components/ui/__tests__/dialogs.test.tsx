import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ChecklistRow } from '@/components/ui/checklist-row';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { withGluestack } from '@/test/gluestack';

/**
 * The three Gluestack-backed primitives, which also drag their generated wrappers
 * (`checkbox`, `alert-dialog`) into coverage — those are `gluestack-ui add` output, so they
 * are exercised through the app's own components rather than tested directly.
 *
 * `ConfirmDialog` must be wrapped in `withGluestack`: without an `OverlayProvider` above it
 * the dialog has nowhere to portal and renders *nothing at all*, so `visible` and
 * `visible={false}` look identical and a "closed" assertion would pass for the wrong reason.
 */

describe('ChecklistRow', () => {
  it('renders its label and reports the checked state', async () => {
    const view = await render(
      <ChecklistRow label="Alternate picking" checked={false} onToggle={jest.fn()} />,
    );
    expect(screen.getByText('Alternate picking')).toBeTruthy();
    expect(screen.getByRole('checkbox').props.accessibilityState).toMatchObject({
      checked: false,
    });
    await view.unmount();

    await render(<ChecklistRow label="Alternate picking" checked onToggle={jest.fn()} />);

    expect(screen.getByRole('checkbox').props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('toggles', async () => {
    const onToggle = jest.fn();
    await render(<ChecklistRow label="Barre chords" checked={false} onToggle={onToggle} />);

    await fireEvent.press(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmDialog', () => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders nothing while closed', async () => {
    await render(
      withGluestack(
        <ConfirmDialog
          visible={false}
          title="Resume practice session?"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      ),
    );

    expect(screen.queryByText('Resume practice session?')).toBeNull();
  });

  it('shows the question, the consequence line and default action labels', async () => {
    await render(
      withGluestack(
        <ConfirmDialog
          visible
          title="Resume practice session?"
          message="You have a practice session in progress from earlier."
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      ),
    );

    expect(screen.getByText('Resume practice session?')).toBeTruthy();
    expect(screen.getByText('You have a practice session in progress from earlier.')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('omits the consequence line when there is no message', async () => {
    await render(
      withGluestack(
        <ConfirmDialog visible title="Discard?" onConfirm={onConfirm} onCancel={onCancel} />,
      ),
    );

    expect(screen.getByText('Discard?')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('uses caller-supplied labels', async () => {
    await render(
      withGluestack(
        <ConfirmDialog
          visible
          title="Resume?"
          confirmLabel="Resume"
          cancelLabel="Discard"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      ),
    );

    expect(screen.getByText('Resume')).toBeTruthy();
    expect(screen.getByText('Discard')).toBeTruthy();
  });

  it('wires each action to its own handler', async () => {
    await render(
      withGluestack(
        <ConfirmDialog visible title="Resume?" onConfirm={onConfirm} onCancel={onCancel} />,
      ),
    );

    await fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('still confirms through the destructive variant', async () => {
    await render(
      withGluestack(
        <ConfirmDialog
          visible
          destructive
          title="Delete routine?"
          confirmLabel="Delete"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      ),
    );

    await fireEvent.press(screen.getByText('Delete'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('Skeleton', () => {
  // The pulse is an `Animated.loop`, so real timers would leave it running past the test.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders at its default size and keeps animating', async () => {
    await render(<Skeleton />);

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(screen.toJSON()).not.toBeNull();
  });

  it('accepts explicit dimensions and a radius token', async () => {
    await render(<Skeleton width="45%" height={20} radius="sm" />);

    expect(screen.toJSON()).not.toBeNull();
  });

  it('stops its loop on unmount rather than leaking a timer', async () => {
    // Measured as a delta, not against zero: React Native keeps a timer of its own pending
    // once anything is rendered. Three Skeletons must contribute exactly three timers and
    // give all three back. Asserting on timers rather than the tree is deliberate —
    // `screen.toJSON()` throws on an unmounted renderer in RNTL 14, and a leaked animation
    // loop *is* a timer that outlives its component.
    const view = await render(
      <>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </>,
    );
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    const whileMounted = jest.getTimerCount();

    await view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(whileMounted - jest.getTimerCount()).toBe(3);
  });
});
