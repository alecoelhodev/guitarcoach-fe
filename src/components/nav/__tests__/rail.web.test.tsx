import { render, screen } from '@testing-library/react-native';
import { type ReactElement } from 'react';

import { Rail } from '@/components/nav/rail.web';

/**
 * `<Link asChild>` renders its child through expo-router's Slot, which **throws** when the
 * child is handed an *array* style:
 *
 *   [expo-router]: You are passing an array of styles to a child of <Slot>.
 *
 * The check sits behind `NODE_ENV !== 'production'`, so a production bundle renders fine
 * while the dev server crashes — `expo export` cannot catch it. These assert the same
 * condition Slot does, over every `Link` the rail renders.
 */
const childStyles: unknown[] = [];

jest.mock('expo-router', () => ({
  usePathname: () => '/',
  Link: ({ children }: { children: ReactElement<{ style?: unknown }> }) => {
    childStyles.push(children.props.style);
    return children;
  },
}));

describe('Rail', () => {
  beforeEach(() => {
    childStyles.length = 0;
  });

  it('never hands an array style to a Link child', async () => {
    await render(<Rail />);

    expect(childStyles.length).toBeGreaterThan(0);
    expect(childStyles.filter((style) => Array.isArray(style))).toEqual([]);
  });

  it('renders Practice plus every destination', async () => {
    await render(<Rail />);

    // Practice leads the rail as an action; the rest are destinations.
    for (const label of [
      'Practice',
      'Home',
      'Routines',
      'Library',
      'History',
      'AI Coach',
      'Profile',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
