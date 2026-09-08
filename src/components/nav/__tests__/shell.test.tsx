jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import AppShell from '@/components/nav/app-shell';
import WebAppShell from '@/components/nav/app-shell.web';
import { PracticeFab } from '@/components/nav/practice-fab';
import { mockRouter } from '@/test/expo-router';

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
