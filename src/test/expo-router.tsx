import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { Text } from 'react-native';

/**
 * The shared `expo-router` mock. Screens only ever reach for `useRouter`, `Link` and
 * `usePathname`, so that is the whole surface — mounting a real router would need `ExpoRoot`,
 * and `expo-router/testing-library` is unusable here (it was built against RNTL 13's
 * synchronous `render`; awaiting RNTL 14's async one drops the `getPathname` helpers it bolts
 * on with `Object.assign`).
 *
 * Use it from a suite as:
 *
 *   jest.mock('expo-router', () => require('@/test/expo-router').expoRouterMock());
 *   import { linkHrefs, mockRouter } from '@/test/expo-router';
 *
 * The `jest.mock` factory cannot close over imported bindings, but it can `require` this
 * module — and Jest's per-file registry means the test file's own import resolves to the same
 * instance, so `mockRouter` is the object the component called.
 *
 * `src/components/nav/__tests__/rail.web.test.tsx` and `auth-form.test.tsx` predate this and
 * hand-roll their own; the rail's mock *is* its assertion mechanism, so both are left alone.
 */

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  dismissAll: jest.fn(),
  setParams: jest.fn(),
  canGoBack: jest.fn(() => true),
};

/**
 * `useNavigation`'s surface, for the screens that dispatch a navigation action directly —
 * `routine-builder`'s unsaved-changes guard resumes the back it interrupted this way.
 */
export const mockNavigation = {
  dispatch: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  setOptions: jest.fn(),
};

/** Every `href` a `Link` was rendered with, in render order. */
export const linkHrefs: unknown[] = [];

let pathname = '/';

export function setMockPathname(next: string) {
  pathname = next;
}

type LinkProps = {
  href: unknown;
  asChild?: boolean;
  onPress?: (event: { preventDefault: () => void }) => void;
  children?: ReactNode;
};

function MockLink({ href, asChild, onPress, children }: LinkProps) {
  linkHrefs.push(href);

  if (asChild) {
    // expo-router's real Slot throws on an array style, but only when
    // `NODE_ENV !== 'production'` — so a production bundle and `expo export` both hide it and
    // the dev server crashes. Reproducing the throw here means every suite that renders a
    // `Link asChild` guards the rule for free, not just the rail's dedicated test.
    if (isValidElement<{ style?: unknown }>(children) && Array.isArray(children.props.style)) {
      throw new Error(
        '[expo-router]: You are passing an array of styles to a child of <Slot>. ' +
          'Flatten it with StyleSheet.flatten or pass a single object.',
      );
    }
    return children as ReactElement;
  }

  // Not `asChild` — `ExternalLink` is the only such caller, and its test needs to press it.
  return (
    <Text accessibilityRole="link" onPress={() => onPress?.({ preventDefault: jest.fn() })}>
      {children}
    </Text>
  );
}

export function expoRouterMock() {
  return {
    useRouter: () => mockRouter,
    useNavigation: () => mockNavigation,
    usePathname: () => pathname,
    Link: MockLink,
  };
}

// Registered here rather than left to each suite: a stale `linkHrefs` is invisible until an
// unrelated assertion counts the wrong number of links.
beforeEach(() => {
  linkHrefs.length = 0;
  pathname = '/';
  for (const fn of Object.values(mockRouter)) fn.mockClear();
  for (const fn of Object.values(mockNavigation)) fn.mockClear();
});
