/**
 * Type scale from `wireframes/Guitar Coach Wireframes.dc.html`, **rescaled for a real
 * viewport**.
 *
 * The canvas draws its phone inside a `max-width:318px` frame, so its px values are sized
 * for a 318-wide viewport. React Native measures in density-independent points, where a
 * modern handset is 390–440 — the scale had been ported 1:1 into that, which shipped body
 * copy at 11.5pt and input text at 12.5pt. Every size below is the canvas value × 390/318,
 * rounded to the nearest half point: the proportions the canvas specifies are unchanged,
 * only the viewport they were drawn for is corrected. Do not "restore" the canvas numbers.
 *
 * One family (Inter) in five weights. React Native cannot synthesise weights on
 * Android, so each role names its own face rather than setting `fontWeight`.
 *
 * The canvas has exactly two real heading sizes: `.h1` for screen titles and `.h2` for card
 * titles. The ladder below is anchored so that the two roles screens already use most —
 * `h3` and `h5` — land on those two, which is why the migration needed no per-screen role
 * changes.
 */

export const FontFamily = {
  display: 'Inter_800ExtraBold',
  heading: 'Inter_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

/**
 * Canvas frame width → phone width. Exported so anything that still needs to carry a raw
 * canvas measurement into a style can apply the same correction rather than guessing.
 */
export const CANVAS_SCALE = 390 / 318;

export const Typography = {
  // `.big` — the session clock and the weekly stat figures. Canvas 46.
  display: {
    fontFamily: FontFamily.display,
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -0.03 * 56,
  },
  // Canvas 28.
  h1: {
    fontFamily: FontFamily.heading,
    fontSize: 34,
    lineHeight: 34 * 1.15,
    letterSpacing: -0.01 * 34,
  },
  // Canvas 24.
  h2: {
    fontFamily: FontFamily.heading,
    fontSize: 29.5,
    lineHeight: 29.5 * 1.2,
    letterSpacing: -0.01 * 29.5,
  },
  // Canvas `.h1` (21) — screen titles.
  h3: {
    fontFamily: FontFamily.heading,
    fontSize: 26,
    lineHeight: 26 * 1.15,
    letterSpacing: -0.01 * 26,
  },
  // Canvas 18.
  h4: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    lineHeight: 22 * 1.2,
    letterSpacing: -0.01 * 22,
  },
  // Canvas `.h2` (16) — card titles.
  h5: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    lineHeight: 20 * 1.25,
    letterSpacing: -0.01 * 20,
  },
  // `.xs` (9.5)
  overline: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.07 * 12,
  },
  // `.mt` (11.5)
  body: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 14 * 1.45,
  },
  // `.btnp` (14)
  button: { fontFamily: FontFamily.bodySemiBold, fontSize: 17, lineHeight: 17 * 1.2 },
  // `.in` (12.5)
  input: { fontFamily: FontFamily.body, fontSize: 15.5, lineHeight: 15.5 * 1.2 },
  // `.lb` (12.5)
  label: { fontFamily: FontFamily.bodySemiBold, fontSize: 15.5, lineHeight: 15.5 * 1.35 },
  // `.bdg` (9)
  badge: {
    fontFamily: FontFamily.heading,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.05 * 11,
  },
  // `.err` / `.ok` (10.5)
  caption: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, lineHeight: 13 * 1.35 },
  /**
   * Tab-bar and rail labels. Not a canvas role — the nav chrome carried raw `fontSize`
   * literals at two different values (8.5 and 9.5) for what is visually one thing.
   */
  navLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, lineHeight: 12 * 1.2 },
} as const;

export type TypographyRole = keyof typeof Typography;
