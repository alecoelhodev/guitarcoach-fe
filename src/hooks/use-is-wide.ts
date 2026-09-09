import { useWindowDimensions } from 'react-native';

import { Breakpoint } from '@/theme/tokens';

/**
 * True at canvas 2a's rail-and-two-column width.
 *
 * `useWindowDimensions` subscribes to `Dimensions` on react-native-web too, so
 * this tracks a browser resize rather than latching the first measurement.
 *
 * It lives in its own module so suites can `jest.mock('@/hooks/use-is-wide')`;
 * mocking `react-native` itself means spreading `jest.requireActual`, which is
 * unreliable under the New Architecture.
 */
export function useIsWide() {
  const { width } = useWindowDimensions();
  return width >= Breakpoint.wide;
}
