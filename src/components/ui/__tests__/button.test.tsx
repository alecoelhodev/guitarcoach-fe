import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Button } from '@/components/ui/button';

/**
 * `Button` is the most-imported component in the app, and three of its behaviours are real
 * logic rather than styling. Those three are what is asserted here; the `tva` class strings
 * are not, since asserting them would only restate the file.
 */

describe('Button', () => {
  it('wraps a string child in ButtonText so callers can pass bare text', async () => {
    await render(<Button>Start Practice</Button>);

    expect(screen.getByText('Start Practice')).toBeTruthy();
  });

  it('renders a non-string child as-is, without wrapping it', async () => {
    await render(
      <Button>
        <Text>Custom node</Text>
      </Button>,
    );

    expect(screen.getByText('Custom node')).toBeTruthy();
  });

  it('presses', async () => {
    const onPress = jest.fn();
    await render(<Button onPress={onPress}>Save</Button>);

    await fireEvent.press(screen.getByText('Save'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled while loading, even though `disabled` was not passed', async () => {
    const onPress = jest.fn();
    await render(
      <Button loading onPress={onPress}>
        Save
      </Button>,
    );

    await fireEvent.press(screen.getByText('Save'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('swaps in loadingLabel only while loading', async () => {
    const view = await render(<Button loadingLabel="Saving…">Save</Button>);
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.queryByText('Saving…')).toBeNull();
    await view.unmount();

    await render(
      <Button loading loadingLabel="Saving…">
        Save
      </Button>,
    );

    expect(screen.getByText('Saving…')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('keeps the original label when loading without a loadingLabel', async () => {
    await render(<Button loading>Save</Button>);

    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('respects an explicit disabled', async () => {
    const onPress = jest.fn();
    await render(
      <Button disabled onPress={onPress}>
        Save
      </Button>,
    );

    await fireEvent.press(screen.getByText('Save'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary', 'tertiary', 'ghost'] as const)(
    'renders the %s variant',
    async (variant) => {
      await render(<Button variant={variant}>Label</Button>);

      expect(screen.getByText('Label')).toBeTruthy();
    },
  );

  it('renders the block and prominent flags', async () => {
    await render(
      <Button block prominent>
        Label
      </Button>,
    );

    expect(screen.getByText('Label')).toBeTruthy();
  });
});
