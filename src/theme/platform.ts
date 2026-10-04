/**
 * Platform-dependent layout constants.
 *
 * Split out of `tokens.ts` so that file stays a pure data module: `tailwind.config.ts`
 * loads the tokens outside a React Native runtime, where importing `Platform` fails.
 */

import { Platform } from 'react-native';

/**
 * Height of the tab bar's own chrome, **not counting the home indicator or gesture bar**.
 * NativeTabs draws the real OS bar, so this is a measurement, not a value we control.
 *
 * Screens should not read this directly — use `useBottomInset()` from `@/hooks/use-bottom-inset`,
 * which adds the device's bottom safe-area inset. On a handset with a home indicator the bar
 * is this tall *plus* that inset, and padding by the constant alone left the last row of
 * every tab list tucked under the bar.
 */
export const TabBarChrome = Platform.select({ ios: 50, android: 56 }) ?? 0;
