jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());

import { render, screen } from '@testing-library/react-native';

import { BottomBar } from '@/components/nav/bottom-bar.web';
import { PRACTICE_HREF } from '@/components/nav/destinations';
import { linkHrefs, setMockPathname } from '@/test/expo-router';
import { Colors } from '@/theme/tokens';

/**
 * The shared mock reproduces expo-router's Slot check, which **throws** when a
 * `<Link asChild>` child is handed an *array* style. That check sits behind
 * `NODE_ENV !== 'production'`, so a production bundle renders fine while the dev
 * server crashes — `expo export` cannot catch it. Every render below therefore
 * doubles as that guard.
 */

describe('BottomBar', () => {
  it('renders the canvas four tabs plus the centre Practice action', async () => {
    await render(<BottomBar />);

    for (const label of ['Home', 'Routines', 'Practice', 'Library', 'Profile']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  // Canvas 02 gives the narrow viewport a four-tab budget and reaches these two
  // from Home instead; they are rail entries only because the wide viewport has room.
  it('leaves History and AI Coach off the bar', async () => {
    await render(<BottomBar />);

    expect(screen.queryByText('History')).toBeNull();
    expect(screen.queryByText('AI Coach')).toBeNull();
  });

  it('sends Practice to the routines list, where a session starts', async () => {
    await render(<BottomBar />);

    expect(linkHrefs).toContain(PRACTICE_HREF);
  });

  it('tints only the tab matching the current route', async () => {
    setMockPathname('/routines');
    await render(<BottomBar />);

    expect(screen.getByText('Routines')).toHaveStyle({ color: Colors.accentRamp[700] });
    expect(screen.getByText('Library')).toHaveStyle({ color: Colors.neutral[600] });
  });

  // Home owns the exact root only; `startsWith('/')` would light it on every route.
  it('does not light Home while another route is open', async () => {
    setMockPathname('/library');
    await render(<BottomBar />);

    expect(screen.getByText('Home')).toHaveStyle({ color: Colors.neutral[600] });
  });
});
