import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useBottomInset } from '@/hooks/use-bottom-inset';
import { TabBarChrome } from '@/theme/platform';

/**
 * The bug this exists for: the app padded tab screens by `TabBarChrome` alone, which is the
 * bar's visible height and nothing else. On any handset with a home indicator the bar also
 * sits on top of a ~34pt inset, so the last row of every list was tucked behind it.
 *
 * The package's jest mock resolves `useSafeAreaInsets` from `SafeAreaInsetsContext` when one
 * is present and falls back to zero insets — which is exactly the two devices worth testing.
 */
const withInsets = (bottom: number) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaInsetsContext.Provider value={{ top: 47, bottom, left: 0, right: 0 }}>
        {children}
      </SafeAreaInsetsContext.Provider>
    );
  };

describe('useBottomInset', () => {
  it('clears the home indicator as well as the bar', async () => {
    const { result } = await renderHook(() => useBottomInset(), { wrapper: withInsets(34) });

    expect(result.current).toBe(TabBarChrome + 34);
  });

  it('is just the bar on a device with no inset', async () => {
    const { result } = await renderHook(() => useBottomInset(), { wrapper: withInsets(0) });

    expect(result.current).toBe(TabBarChrome);
  });
});
