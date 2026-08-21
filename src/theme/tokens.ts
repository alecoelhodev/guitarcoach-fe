/**
 * Organic design tokens, ported verbatim from `_ds/organic-.../styles.css`.
 * Do not substitute approximations — see plan/SETUP-PLAN.md step 5.
 */

import { Platform } from 'react-native';

export const Colors = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  accent: '#c67139',
  accent2: '#7a8a5e',
  divider: 'rgba(32,30,29,0.16)',
  textMuted: 'rgba(32,30,29,0.55)',

  neutral: {
    100: '#f9f4ed',
    200: '#eee7db',
    300: '#dcd3c4',
    400: '#c0b6a5',
    500: '#a19786',
    600: '#82796a',
    700: '#645c50',
    800: '#474238',
    900: '#2e2b25',
  },
  accentRamp: {
    100: '#fff2eb',
    200: '#ffe1d0',
    300: '#ffc6a5',
    400: '#f6a06b',
    500: '#d67f48',
    600: '#b2622d',
    700: '#8c491a',
    800: '#643312',
    900: '#402310',
  },
  accent2Ramp: {
    100: '#f0fae1',
    200: '#e1eecc',
    300: '#ccdbb2',
    400: '#aebf92',
    500: '#8fa073',
    600: '#728157',
    700: '#56633f',
    800: '#3d472b',
    900: '#272e1b',
  },
} as const;

// Organic's 1.10x density scale, rounded from 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2
export const Spacing = { 1: 4, 2: 9, 3: 13, 4: 18, 6: 26, 8: 35 } as const;

export const Radius = { sm: 8, md: 16, lg: 28, pill: 999 } as const;

export const Shadow = {
  sm: {
    shadowColor: '#2e2b25',
    shadowOpacity: 0.14,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: '#2e2b25',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#2e2b25',
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

// Interaction states prescribed by the Organic system — build into primitives once.
export const Interaction = {
  primaryHover: Colors.accentRamp[600],
  primaryPressed: Colors.accentRamp[700],
  focusRingColor: Colors.accent,
  focusRingWidth: 2,
  focusRingOffset: 2,
  disabledOpacity: 0.45,
} as const;

export const MaxContentWidth = 800;

// Approximate native tab bar height, so scrollable screens can pad their bottom
// content past it — see plan/SETUP-PLAN.md step 8 (NativeTabs + floating button).
export const TabBarInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
