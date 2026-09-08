import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ErrorBoundaryFallback } from '@/components/error-boundary-fallback';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/theme/tokens';

/**
 * `ThemedText` and `ThemedView` are the two lowest-level wrappers in the app — around thirty
 * files depend on their defaults, so those defaults are what is pinned here. The style
 * assertions are the exception to "don't assert `StyleSheet` values": the point is that the
 * *default* resolves to `body`/`text` and `bg`, not what those tokens happen to equal.
 */

describe('ThemedText', () => {
  it('defaults to the body role in the primary text colour', async () => {
    await render(<ThemedText>Practice</ThemedText>);

    const flattened = Object.assign({}, ...screen.getByText('Practice').props.style);
    expect(flattened.color).toBe(Colors.text);
  });

  it.each(['display', 'h1', 'h3', 'h5', 'label', 'body', 'caption', 'overline', 'badge'] as const)(
    'renders the %s role',
    async (type) => {
      await render(<ThemedText type={type}>Text</ThemedText>);

      expect(screen.getByText('Text')).toBeTruthy();
    },
  );

  it.each(['text', 'textMuted', 'accent', 'accent2'] as const)(
    'applies the %s colour',
    async (color) => {
      await render(<ThemedText color={color}>Text</ThemedText>);

      const flattened = Object.assign({}, ...screen.getByText('Text').props.style);
      expect(flattened.color).toBe(Colors[color]);
    },
  );

  it('lets a caller-supplied style win over the role', async () => {
    await render(<ThemedText style={{ color: '#ff0000' }}>Text</ThemedText>);

    const flattened = Object.assign({}, ...screen.getByText('Text').props.style);
    expect(flattened.color).toBe('#ff0000');
  });

  it('passes other Text props through', async () => {
    await render(<ThemedText numberOfLines={2}>Text</ThemedText>);

    expect(screen.getByText('Text').props.numberOfLines).toBe(2);
  });
});

describe('ThemedView', () => {
  it('defaults to the page ground', async () => {
    await render(
      <ThemedView testID="view">
        <Text>child</Text>
      </ThemedView>,
    );

    const flattened = Object.assign({}, ...screen.getByTestId('view').props.style);
    expect(flattened.backgroundColor).toBe(Colors.bg);
    expect(screen.getByText('child')).toBeTruthy();
  });

  it('renders the surface ground when asked', async () => {
    await render(<ThemedView testID="view" type="surface" />);

    const flattened = Object.assign({}, ...screen.getByTestId('view').props.style);
    expect(flattened.backgroundColor).toBe(Colors.surface);
  });
});

describe('ErrorBoundaryFallback', () => {
  it('shows the thrown message and offers a retry', async () => {
    const retry = jest.fn();
    await render(<ErrorBoundaryFallback error={new Error('Boom')} retry={retry} />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Boom')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
