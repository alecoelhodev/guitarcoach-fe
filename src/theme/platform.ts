/**
 * Platform-dependent layout constants.
 *
 * Split out of `tokens.ts` so that file stays a pure data module: `tailwind.config.ts`
 * loads the tokens outside a React Native runtime, where importing `Platform` fails.
 */

import { Platform } from 'react-native';

// Approximate native tab bar height, so scrollable screens can pad their bottom
// content past it. NativeTabs draws the real OS bar, so this is a measurement,
// not a value we control.
export const TabBarInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
