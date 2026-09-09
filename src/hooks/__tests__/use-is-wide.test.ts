import { renderHook } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { useIsWide } from '@/hooks/use-is-wide';
import { Breakpoint } from '@/theme/tokens';

/**
 * `useWindowDimensions` reads `Dimensions.get('window')` for its initial state and
 * again inside its effect, so spying on `get` is enough to drive the hook — and it
 * exercises the real RN hook rather than a stand-in for it. Every *consumer* suite
 * mocks `@/hooks/use-is-wide` instead; this is the one place the threshold itself
 * is checked.
 */
function atWidth(width: number) {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });
}

afterEach(() => jest.restoreAllMocks());

describe('useIsWide', () => {
  it('is false on a phone-width viewport, where the 198px rail would not fit', async () => {
    atWidth(390);

    const { result } = await renderHook(() => useIsWide());

    expect(result.current).toBe(false);
  });

  it('is true on a desktop viewport', async () => {
    atWidth(1240);

    const { result } = await renderHook(() => useIsWide());

    expect(result.current).toBe(true);
  });

  // Canvas 1h: "at 768px and up the bottom nav becomes the left rail" — inclusive.
  it('switches exactly at the breakpoint, not one pixel past it', async () => {
    atWidth(Breakpoint.wide);
    const { result: atBreakpoint } = await renderHook(() => useIsWide());
    expect(atBreakpoint.current).toBe(true);

    atWidth(Breakpoint.wide - 1);
    const { result: below } = await renderHook(() => useIsWide());
    expect(below.current).toBe(false);
  });
});
