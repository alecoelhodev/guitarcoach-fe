jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
jest.mock('@/hooks/use-is-wide', () => ({ useIsWide: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import AppShell from '@/components/nav/app-shell';
import WebAppShell from '@/components/nav/app-shell.web';
import { PracticeFab } from '@/components/nav/practice-fab';
import { useIsWide } from '@/hooks/use-is-wide';
import { mockRouter } from '@/test/expo-router';

const mockIsWide = useIsWide as jest.MockedFunction<typeof useIsWide>;

beforeEach(() => mockIsWide.mockReturnValue(true));

/**
 * The web shell is imported by explicit path, the way `rail.web.test.tsx` does it — the
 * jest-expo preset is iOS-only (`haste.defaultPlatform: 'ios'`), so `@/components/nav/app-shell`
 * alone would always resolve to the native file.
 */

describe('AppShell (native)', () => {
  it('adds no chrome of its own — NativeTabs already drew it', async () => {
    await render(
      <AppShell>
        <Text>screen</Text>
      </AppShell>,
    );

    expect(screen.getByText('screen')).toBeTruthy();
  });
});

describe('AppShell (web)', () => {
  it('wraps the screen in the rail, which native leaves to the tabs group', async () => {
    await render(
      <WebAppShell>
        <Text>screen</Text>
      </WebAppShell>,
    );

    expect(screen.getByText('screen')).toBeTruthy();
    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('Routines')).toBeTruthy();
  });

  /**
   * Canvas 1h puts the switch at 768px. The rail is a fixed 198px, so rendering it
   * on a phone-width browser leaves almost nothing for the content column — which
   * is what shipped before this branch existed.
   */
  it('swaps the rail for the bottom bar below the breakpoint', async () => {
    mockIsWide.mockReturnValue(false);

    await render(
      <WebAppShell>
        <Text>screen</Text>
      </WebAppShell>,
    );

    expect(screen.getByText('screen')).toBeTruthy();
    // The rail is the only chrome carrying the wordmark, and the only one with
    // History and AI Coach entries.
    expect(screen.queryByText('Guitar Coach')).toBeNull();
    expect(screen.queryByText('History')).toBeNull();
    // The bar still carries the four tabs and the centre action.
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Practice')).toBeTruthy();
  });

  it('shows the rail, and only the rail, above the breakpoint', async () => {
    await render(
      <WebAppShell>
        <Text>screen</Text>
      </WebAppShell>,
    );

    expect(screen.getByText('Guitar Coach')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
    // One Practice action, not one per shell.
    expect(screen.getAllByText('Practice')).toHaveLength(1);
  });
});

describe('PracticeFab', () => {
  it('sends the user to the routines list, which is where practice starts', async () => {
    await render(<PracticeFab />);

    await fireEvent.press(screen.getByLabelText('Start practice'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/(main)/(tabs)/routines');
  });

  it('carries a label rather than an icon, per the canvas', async () => {
    await render(<PracticeFab />);

    expect(screen.getByText('Practice')).toBeTruthy();
  });

  // The `pressed && styles.pressed` dim is not asserted: Pressable resolves its style
  // function internally, so `props.style` on the host is already the idle result, and
  // `fireEvent(fab, 'pressIn')` only calls the *prop* — it never reaches Pressability's own
  // pressed state. Covering it would mean testing React Native, not this component.
});
