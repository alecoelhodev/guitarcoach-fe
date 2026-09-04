/**
 * Type scale from `wireframes/Guitar Coach Wireframes.dc.html`.
 *
 * One family (Inter) in five weights. React Native cannot synthesise weights on
 * Android, so each role names its own face rather than setting `fontWeight`.
 *
 * The canvas has exactly two real heading sizes: `.h1` at 21px for screen titles and
 * `.h2` at 16px for card titles. The ladder below is anchored so that the two roles
 * screens already use most — `h3` (10 call sites) and `h5` (16) — land on those two
 * sizes, which is why the migration needs no per-screen role changes.
 */

export const FontFamily = {
  display: 'Inter_800ExtraBold',
  heading: 'Inter_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const Typography = {
  // `.big` — the session clock and the weekly stat figures.
  display: {
    fontFamily: FontFamily.display,
    fontSize: 46,
    lineHeight: 46,
    letterSpacing: -0.03 * 46,
  },
  h1: {
    fontFamily: FontFamily.heading,
    fontSize: 28,
    lineHeight: 28 * 1.15,
    letterSpacing: -0.01 * 28,
  },
  h2: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    lineHeight: 24 * 1.2,
    letterSpacing: -0.01 * 24,
  },
  // Canvas `.h1` — screen titles.
  h3: {
    fontFamily: FontFamily.heading,
    fontSize: 21,
    lineHeight: 21 * 1.15,
    letterSpacing: -0.01 * 21,
  },
  h4: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    lineHeight: 18 * 1.2,
    letterSpacing: -0.01 * 18,
  },
  // Canvas `.h2` — card titles.
  h5: {
    fontFamily: FontFamily.heading,
    fontSize: 16,
    lineHeight: 16 * 1.25,
    letterSpacing: -0.01 * 16,
  },
  // `.xs`
  overline: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9.5,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.07 * 9.5,
  },
  // `.mt`
  body: {
    fontFamily: FontFamily.body,
    fontSize: 11.5,
    lineHeight: 11.5 * 1.45,
  },
  // `.btnp`
  button: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, lineHeight: 14 * 1.2 },
  // `.in`
  input: { fontFamily: FontFamily.body, fontSize: 12.5, lineHeight: 12.5 * 1.2 },
  // `.lb`
  label: { fontFamily: FontFamily.bodySemiBold, fontSize: 12.5, lineHeight: 12.5 * 1.35 },
  // `.bdg`
  badge: {
    fontFamily: FontFamily.heading,
    fontSize: 9,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.05 * 9,
  },
  // `.err` / `.ok`
  caption: { fontFamily: FontFamily.bodySemiBold, fontSize: 10.5, lineHeight: 10.5 * 1.35 },
} as const;

export type TypographyRole = keyof typeof Typography;
