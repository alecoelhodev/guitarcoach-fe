import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarChrome } from '@/theme/platform';

/**
 * How much room the bottom of a tab screen has to leave: the tab bar's chrome plus the
 * device's own bottom inset.
 *
 * `TabBarChrome` alone was what the app used, and it is only the bar's visible height —
 * on anything with a home indicator the bar also sits on top of a ~34pt inset, so the last
 * row of every list ended up behind it. Web returns the chrome as 0 and an inset of 0, because
 * `app-shell.web.tsx` renders the bottom bar as a flex sibling rather than an overlay.
 *
 * It lives in its own module so suites can mock it, matching `use-is-wide`.
 */
export function useBottomInset() {
  const insets = useSafeAreaInsets();
  return TabBarChrome + insets.bottom;
}
