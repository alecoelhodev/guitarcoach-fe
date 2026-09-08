import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorPanel } from '@/components/ui/error-panel';

/**
 * The three status surfaces. All three gate their optional parts on truthiness, and two of
 * them gate the action on `actionLabel && onAction` — half a pair renders nothing, which is
 * the branch worth pinning.
 *
 * None of them can be found with `getByRole('alert')`: each sets `accessibilityRole="alert"`
 * on a plain `View` without `accessible`, so React Native never makes it an accessibility
 * element. That is a real gap in the components, reported separately; here the role is
 * asserted off the rendered tree instead.
 */

describe('Banner', () => {
  it('renders title only, with no message and no action', async () => {
    await render(<Banner title="Saves straight away" />);

    expect(screen.getByText('Saves straight away')).toBeTruthy();
    expect(screen.toJSON()).toMatchObject({ props: { accessibilityRole: 'alert' } });
  });

  it('renders the message when given one', async () => {
    await render(<Banner title="No connection" message="Check your network." />);

    expect(screen.getByText('Check your network.')).toBeTruthy();
  });

  it('renders the action only when both the label and the handler are present', async () => {
    const onAction = jest.fn();

    const withLabelOnly = await render(<Banner title="Offline" actionLabel="Retry" />);
    expect(screen.queryByText('Retry')).toBeNull();
    await withLabelOnly.unmount();

    const withHandlerOnly = await render(<Banner title="Offline" onAction={onAction} />);
    expect(screen.queryByText('Retry')).toBeNull();
    await withHandlerOnly.unmount();

    await render(<Banner title="Offline" actionLabel="Retry" onAction={onAction} />);
    await fireEvent.press(screen.getByText('Retry'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it.each(['error', 'info', 'success'] as const)('renders the %s tone', async (tone) => {
    await render(<Banner title="Heads up" tone={tone} />);

    expect(screen.getByText('Heads up')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('renders the title alone', async () => {
    await render(<EmptyState title="No routines yet" />);

    expect(screen.getByText('No routines yet')).toBeTruthy();
  });

  it('renders the optional icon and message', async () => {
    await render(
      <EmptyState
        icon={<Text>ICON</Text>}
        title="No routines yet"
        message="Ask the AI Coach to build your first one."
      />,
    );

    expect(screen.getByText('ICON')).toBeTruthy();
    expect(screen.getByText('Ask the AI Coach to build your first one.')).toBeTruthy();
  });

  it('needs both the label and the handler to render its action', async () => {
    const onAction = jest.fn();

    const partial = await render(<EmptyState title="Empty" actionLabel="Create" />);
    expect(screen.queryByText('Create')).toBeNull();
    await partial.unmount();

    await render(<EmptyState title="Empty" actionLabel="Create" onAction={onAction} />);
    await fireEvent.press(screen.getByText('Create'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorPanel', () => {
  it('renders the title alone and carries the alert role', async () => {
    await render(<ErrorPanel title="Couldn't load routines" />);

    expect(screen.getByText("Couldn't load routines")).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
    expect(screen.toJSON()).toMatchObject({ props: { accessibilityRole: 'alert' } });
  });

  it('renders the message when given one', async () => {
    await render(<ErrorPanel title="Offline" message="Check your connection." />);

    expect(screen.getByText('Check your connection.')).toBeTruthy();
  });

  it('offers retry only when a handler is passed, and calls it', async () => {
    const onRetry = jest.fn();
    await render(<ErrorPanel title="Offline" onRetry={onRetry} />);

    await fireEvent.press(screen.getByText('Try again'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
