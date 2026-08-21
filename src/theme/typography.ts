/**
 * Organic type scale — see plan/SETUP-PLAN.md step 5.
 *
 * Deviation: phone screens use h3/h4 for screen titles, not h1. 42px is a web/hero
 * size; the mobile wireframes sit around 20px. Same tokens, different step.
 */

export const FontFamily = {
  display: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemiBold: 'Figtree_600SemiBold',
} as const;

export const Typography = {
  h1: {
    fontFamily: FontFamily.display,
    fontSize: 42,
    lineHeight: 42 * 1.12,
    letterSpacing: -0.015 * 42,
  },
  h2: { fontFamily: FontFamily.display, fontSize: 32, lineHeight: 32 * 1.12 },
  h3: { fontFamily: FontFamily.display, fontSize: 25, lineHeight: 25 * 1.12 },
  h4: { fontFamily: FontFamily.display, fontSize: 20, lineHeight: 20 * 1.12 },
  h5: { fontFamily: FontFamily.display, fontSize: 16, lineHeight: 16 * 1.12 },
  overline: {
    fontFamily: FontFamily.display,
    fontSize: 13,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.08 * 13,
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    lineHeight: 15 * 1.55,
    fontWeight: '400' as const,
  },
  button: { fontFamily: FontFamily.display, fontSize: 14, lineHeight: 14 * 1.2 },
  input: { fontFamily: FontFamily.display, fontSize: 14, lineHeight: 14 * 1.2 },
  label: { fontFamily: FontFamily.body, fontSize: 12 },
  caption: { fontFamily: FontFamily.body, fontSize: 11 },
} as const;

export type TypographyRole = keyof typeof Typography;
