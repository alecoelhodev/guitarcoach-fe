/**
 * Design tokens, ported verbatim from the `:root` block of
 * `wireframes/Guitar Coach Wireframes.dc.html`. Do not substitute approximations.
 *
 * This module must stay free of `react-native` imports — `tailwind.config.ts` loads it
 * outside a RN runtime. Platform-dependent values live in `./platform`.
 */

export const Colors = {
  bg: '#0a0b0d',
  surface: '#141519',
  text: '#f2f3f5',
  accent: '#2f88f0',
  accent2: '#22c55e',
  danger: '#e35d4f',
  divider: 'rgba(255,255,255,0.10)',
  // The canvas renders muted body copy (`.mt`) as neutral-700 rather than an alpha.
  textMuted: '#a8adb5',

  neutral: {
    100: '#17181c',
    200: '#1d1f24',
    300: '#282b31',
    400: '#3a3e46',
    500: '#585e67',
    600: '#7d838c',
    700: '#a8adb5',
    800: '#c9cdd3',
    900: '#eceef0',
  },
  accentRamp: {
    100: '#122540',
    200: '#173a5f',
    300: '#2c5687',
    400: '#3f76b8',
    500: '#5aa4f5',
    600: '#4396f2',
    700: '#7ec2fb',
    800: '#0d1f38',
    900: '#081226',
  },
  // The canvas defines only these four steps for the green and five for the red.
  accent2Ramp: {
    100: '#0f2e1c',
    200: '#123d24',
    700: '#5fe0a0',
    800: '#0c2417',
  },
  dangerRamp: {
    100: '#3a1512',
    200: '#4a1a16',
    300: '#7a2e26',
    600: '#e35d4f',
    700: '#ff8a7c',
  },
} as const;

// Organic's 1.10x density scale, rounded from 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2.
// Keys 5 and 7 are deliberately absent — iterate with Object.entries, never 1..8.
export const Spacing = { 1: 4, 2: 9, 3: 13, 4: 18, 6: 26, 8: 35 } as const;

/**
 * Canvas radii. Five steps rather than three:
 * xs = checkbox tick, sm = inputs / tertiary buttons / rail items,
 * md = primary + secondary buttons, lg = panels and toasts, xl = cards.
 *
 * `pill` is still current — chips, badges, the segmented track, the minutes stepper
 * and round icon buttons all use it. Only *text* buttons stopped being pills.
 */
export const Radius = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  sheet: 24,
  pill: 999,
} as const;

// Retuned for a #0a0b0d ground — the Organic values were mixed for a light surface
// and are invisible here.
export const Shadow = {
  sm: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  lg: {
    shadowColor: '#000000',
    shadowOpacity: 0.65,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
} as const;

// Interaction states built into the primitives once. The canvas specifies no
// hover/pressed tints, so these follow the dark-UI convention: hover lightens,
// pressed darkens. The focus ring uses accent-700 for visibility on a dark ground.
export const Interaction = {
  primaryHover: Colors.accentRamp[500],
  primaryPressed: Colors.accentRamp[400],
  focusRingColor: Colors.accentRamp[700],
  focusRingWidth: 2,
  focusRingOffset: 2,
  disabledOpacity: 0.45,
} as const;

// Canvas 1h: one content column capped at 560px on mobile and tablet.
export const MaxContentWidth = 560;

// Canvas 2f: the AI Coach conversation caps tighter than the rest of the app.
export const ConversationMaxWidth = 640;
