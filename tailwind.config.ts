import type { Config } from 'tailwindcss';

import { Colors, Radius, Spacing } from './src/theme/tokens';
import { FontFamily } from './src/theme/typography';

// `Spacing` is intentionally sparse (no 5, no 7 — see tokens.ts), so derive the scale
// from its own entries rather than a numeric range.
const spacing = Object.fromEntries(Object.entries(Spacing).map(([step, px]) => [step, `${px}px`]));

const borderRadius = Object.fromEntries(
  Object.entries(Radius).map(([name, px]) => [name, `${px}px`]),
);

export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: Colors.bg,
        surface: Colors.surface,
        text: Colors.text,
        divider: Colors.divider,
        muted: Colors.textMuted,
        accent: { DEFAULT: Colors.accent, ...Colors.accentRamp },
        accent2: { DEFAULT: Colors.accent2, ...Colors.accent2Ramp },
        danger: { DEFAULT: Colors.danger, ...Colors.dangerRamp },
        neutral: Colors.neutral,
      },
      spacing,
      borderRadius,
      fontFamily: {
        display: [FontFamily.display],
        heading: [FontFamily.heading],
        body: [FontFamily.body],
        'body-medium': [FontFamily.bodyMedium],
        'body-semibold': [FontFamily.bodySemiBold],
      },
    },
  },
  plugins: [],
} satisfies Config;
