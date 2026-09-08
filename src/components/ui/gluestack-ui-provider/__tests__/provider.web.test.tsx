/**
 * @jest-environment jsdom
 */

// See `script.web.test.ts` for why these two globals have to be installed by hand under jsdom.
Object.assign(globalThis, {
  TextEncoder: require('node:util').TextEncoder,
  TextDecoder: require('node:util').TextDecoder,
});

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider/index.web';

/**
 * The web provider is imported by explicit path — the jest-expo preset is iOS-only, so
 * `@/components/ui/gluestack-ui-provider` always resolves to the native file. Same approach as
 * `rail.web.test.tsx`.
 *
 * It differs from the native provider in three ways worth pinning: it defaults to `light`
 * rather than `system`, it writes the mode onto `document.documentElement` in a layout effect,
 * and in `system` mode it subscribes to `prefers-color-scheme` and unsubscribes on unmount.
 */

type MediaListener = (event: { matches: boolean }) => void;

let listeners: MediaListener[] = [];
let removed: MediaListener[] = [];

function stubMatchMedia(matches: boolean) {
  listeners = [];
  removed = [];
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn(() => ({
      matches,
      addListener: (fn: MediaListener) => listeners.push(fn),
      removeListener: (fn: MediaListener) => removed.push(fn),
    })),
  });
}

beforeEach(() => {
  document.documentElement.className = '';
  document.documentElement.style.colorScheme = '';
  stubMatchMedia(false);
});

describe('GluestackUIProvider (web)', () => {
  it('renders its children', async () => {
    await render(
      <GluestackUIProvider>
        <Text>child</Text>
      </GluestackUIProvider>,
    );

    expect(screen.getByText('child')).toBeTruthy();
  });

  it('defaults to light and applies it to the document', async () => {
    await render(<GluestackUIProvider />);

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('applies an explicit dark mode and clears the opposite class', async () => {
    document.documentElement.classList.add('light');

    await render(<GluestackUIProvider mode="dark" />);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('does not write a class of its own in system mode', async () => {
    await render(<GluestackUIProvider mode="system" />);

    // In `system` the pre-hydration `<script>` owns the class; the effect only subscribes.
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('subscribes to the system preference only in system mode', async () => {
    const explicit = await render(<GluestackUIProvider mode="light" />);
    expect(listeners).toHaveLength(0);
    await explicit.unmount();

    stubMatchMedia(false);
    await render(<GluestackUIProvider mode="system" />);

    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    expect(listeners).toHaveLength(1);
  });

  it('re-applies the mode when the system preference changes', async () => {
    await render(<GluestackUIProvider mode="system" />);

    listeners[0]({ matches: true } as MediaQueryListEvent);

    expect(document.documentElement.classList.contains('dark')).toBe(true);

    listeners[0]({ matches: false } as MediaQueryListEvent);

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('unsubscribes on unmount rather than leaking a media listener', async () => {
    const view = await render(<GluestackUIProvider mode="system" />);

    await view.unmount();

    expect(removed).toHaveLength(1);
    expect(removed[0]).toBe(listeners[0]);
  });
});
