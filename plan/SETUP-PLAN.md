# Guitar Coach FE — cleanup & setup plan

Executable plan for `guitar-coach-fe` (Expo SDK 57, React Native 0.86, React 19.2, Expo Router 57).
Run these steps with Claude Code from the repo root.

**Before writing any code:** `AGENTS.md` in the repo says to read
https://docs.expo.dev/versions/v57.0.0/ first. SDK 57 changed several APIs — verify each
package below against the versioned docs rather than trusting habit.

---

## 1. Delete template leftovers

```
src/app/explore.tsx
src/components/animated-icon.tsx
src/components/animated-icon.web.tsx
src/components/animated-icon.module.css
src/components/web-badge.tsx
src/components/hint-row.tsx
src/components/ui/collapsible.tsx
scripts/reset-project.js
assets/images/react-logo.png
assets/images/react-logo@2x.png
assets/images/react-logo@3x.png
assets/images/expo-badge.png
assets/images/expo-badge-white.png
assets/images/expo-logo.png
assets/images/logo-glow.png
assets/images/tutorial-web.png
assets/images/tabIcons/            (whole folder — replaced by Lucide)
```

Also remove the `reset-project` script from `package.json`.

**Keep:** `src/components/external-link.tsx` — task detail screens open reference links
outside the app, so this is real functionality, not template filler.

**Keep for now:** `src/hooks/use-color-scheme.ts` / `.web.ts`. Organic is a single light
theme and the wireframes mark Appearance as a future setting, so the app ships light-only —
but leaving the hook in place keeps the door open without costing anything.

## 2. Rewrite, don't delete

These files stay but their contents are all template:

| File                              | What changes                                                                |
| --------------------------------- | --------------------------------------------------------------------------- |
| `src/constants/theme.ts`          | Replaced wholesale by the Organic token layer (step 5)                      |
| `src/global.css`                  | Web font vars → Caprasimo / Figtree                                         |
| `src/components/themed-text.tsx`  | Type scale is wrong (48px title @ weight 600); rebuild on the Organic scale |
| `src/components/themed-view.tsx`  | Colour roles change with the token layer                                    |
| `src/components/app-tabs.tsx`     | See the open decision in step 8                                             |
| `src/components/app-tabs.web.tsx` | Top pill bar → left rail; also carries the "Expo Starter" brand string      |
| `src/app/index.tsx`               | Becomes the Home screen                                                     |
| `app.json`                        | Becomes `app.config.ts` (step 4)                                            |

## 3. Folder structure

```
src/
  app/                          # routes ONLY — no business logic, no styling
    _layout.tsx                 # root: fonts, query client, session gate
    (auth)/
      _layout.tsx
      sign-in.tsx
      create-account.tsx
    (app)/
      _layout.tsx               # tab shell
      index.tsx                 # Home
      routines/index.tsx
      routines/[id].tsx         # builder + details (one screen, per wireframe 06)
      library/index.tsx
      library/[id].tsx          # task details
      history/index.tsx
      history/[id].tsx          # session details + recordings
      coach.tsx
      profile.tsx
    session/active.tsx          # full-screen, outside the tab shell
  api/                          # one module per backend resource
    client.ts                   # fetch wrapper, base URL, session cookie handling
    query-keys.ts
    auth.ts  tasks.ts  routines.ts  sessions.ts  recordings.ts  coach.ts
  features/                     # screen composition, one folder per domain
    auth/  home/  library/  routines/  session/  history/  coach/  profile/
  components/
    ui/                         # the reusable inventory (step 6)
    nav/                        # tab bar (native) + rail (web)
  theme/
    tokens.ts  typography.ts
  hooks/
  lib/                          # duration math, file validation, date grouping
  types/                        # API response types
```

Two rules worth enforcing from the start, because they are cheap now and expensive later:
`app/` files contain routing and layout only, and nothing outside `api/` calls `fetch`.

## 4. Environment handling

Currently absent. `app.json` is static JSON and cannot interpolate, so convert it.

**`app.config.ts`** — port `app.json` verbatim, then change:

- `expo-splash-screen` `backgroundColor`: `#208AEF` → `#f5ead8`
- `android.adaptiveIcon.backgroundColor`: `#E6F4FE` → `#f5ead8`
- add `extra.apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL`

**`.env`** (gitignored) and **`.env.example`** (committed):

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

Read it through `expo-constants` (already installed) rather than touching `process.env`
outside the config, so there is one place the base URL comes from.

Note the app icons are still Expo's artwork — they need real assets before any build.

## 5. Organic token layer

Values below are taken from `_ds/organic-.../styles.css` in the design project. Do not
substitute approximations.

**`src/theme/tokens.ts`**

```ts
export const Colors = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  accent: '#c67139',
  accent2: '#7a8a5e',
  divider: 'rgba(32,30,29,0.16)',

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

// Organic's 1.10× density scale, rounded from 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2
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
```

**`src/theme/typography.ts`** — Organic's scale, with one deviation noted:

| Role           | Size / line-height              | Face      |
| -------------- | ------------------------------- | --------- |
| h1             | 42 / 1.12, tracking −0.015em    | Caprasimo |
| h2             | 32 / 1.12                       | Caprasimo |
| h3             | 25 / 1.12                       | Caprasimo |
| h4             | 20 / 1.12                       | Caprasimo |
| h5             | 16 / 1.12                       | Caprasimo |
| overline       | 13, uppercase, tracking +0.08em | Caprasimo |
| body           | 15 / 1.55, weight 400           | Figtree   |
| button / input | 14 / 1.2                        | Caprasimo |
| label          | 12                              | Figtree   |
| caption        | 11                              | Figtree   |

Deviation: on phone screens use **h3/h4** for screen titles. h1 at 42px is a web and
hero size — the mobile wireframes sit around 20px. Same tokens, different step.

Muted text is `color-mix(text 55%)` in CSS → `rgba(32,30,29,0.55)` in RN.

Interaction states are prescribed by the system, so build them into the primitives once:
primary hover `accentRamp.600`, pressed `accentRamp.700`, focus ring 2px `accent` at 2px
offset, disabled 45% opacity.

## 6. Component inventory to scaffold in `components/ui/`

From the wireframes (option 1g). Each is one file, props-driven, no screen knowledge:

`Button` (primary / secondary / ghost / icon / block) · `Card` · `Badge` (category,
difficulty, neutral) · `Chip` · `Segmented` · `Input` + `FieldLabel` + `ValidationMessage` ·
`Stepper` (minutes) · `ChecklistRow` · `Skeleton` · `Toast` · `ErrorPanel` · `EmptyState` ·
`Sheet` · `ConfirmDialog` · `ProgressBar`

Domain cards live in their feature folders, not here: `RoutineCard`, `TaskCard`,
`SessionCard`, `RecordingRow`, `PlanPreviewCard`.

## 7. Dependencies

Expo-managed (let the CLI resolve versions — do not pin by hand):

```bash
npx expo install expo-secure-store expo-audio expo-document-picker expo-file-system react-native-svg expo-haptics
```

- `expo-secure-store` — session persistence
- `expo-audio` — recording playback (replaced `expo-av`; confirm the SDK 57 API)
- `expo-document-picker` + `expo-file-system` — pick and upload audio
- `react-native-svg` — required by Lucide
- `expo-haptics` — optional, for Complete Task feedback

Plain npm:

```bash
npm i @tanstack/react-query react-hook-form zod @hookform/resolvers lucide-react-native zustand @expo-google-fonts/caprasimo @expo-google-fonts/figtree
npm i -D prettier eslint-config-prettier
```

- `@tanstack/react-query` — server state and the paginated lists (library, routines, history)
- `react-hook-form` + `zod` — inline validation on auth and the routine builder
- `lucide-react-native` — Organic specifies Lucide, stroke-width 2.75
- `zustand` — the active session's local state (timer, ticks, edited minutes), which is
  deliberately never server state until Finish
- the two font packages — Caprasimo and Figtree, loaded via the already-installed `expo-font`

**Verify before committing, do not assume:**

- `@gorhom/bottom-sheet` against Reanimated 4.5.1. If it fights, Expo Router's native modal
  presentation plus a plain view gets the same result with no dependency — worth trying first.
- **Drag-to-reorder: do not install anything yet.** `react-native-draggable-flatlist` has
  known friction with Reanimated 4. Ship Move up / Move down first — it is already the
  accessible path in wireframe 06 and needs no library — then spike drag separately.

Then finish tooling: `npx expo lint` to generate the ESLint config (the script exists but the
config does not), add `.prettierrc`, extend with `eslint-config-prettier`, and add a
`format` script.

## 8. Two decisions that block the tab shell

**The raised Practice button.** `app-tabs.tsx` uses `NativeTabs`, which renders the real
iOS/Android tab bar — a dominant centre action cannot go inside it. Either:

- **(a)** custom JS tab bar — matches the wireframes exactly, loses native behaviour; or
- **(b)** keep `NativeTabs` and float Practice as a button above the bar — native feel kept,
  visually less integrated than drawn.

**Web navigation.** `app-tabs.web.tsx` renders a centred top pill bar. The web wireframes
(option 2a) specify a left rail at 768px and up, with History and AI Coach as their own
entries. The platform fork is already in place, so this is a rewrite of one file — but
confirm the rail is still what you want.

## 9. Order of work

1. Deletions + folder structure (steps 1–3)
2. `app.config.ts` + env (step 4)
3. Token layer + fonts + typography (step 5) — **before any component**
4. Lint / Prettier
5. `api/client.ts` and the resource modules against the verified capability map
6. `components/ui/` primitives (step 6)
7. Route groups + session gate, once step 8 is decided

Steps 1–4 are mechanical. Step 3 is the one to get exactly right: every component built
before the token layer exists gets styled twice.

---

## API constraints the UI must respect

Verified against the `guitar-coach` NestJS repo. These are behavioural, not cosmetic, and
they are not visible in the wireframe pixels:

- **Starting practice creates nothing.** Start Practice loads a routine's tasks and target
  durations into local state. The session is written once, on Finish. Backing out costs
  nothing and must leave no partial record.
- **Session time is optional.** A session has no total-elapsed field. Per-task minutes and
  the completed flag are both optional. The on-screen stopwatch is local pacing only; every
  total in the app is a sum of per-task minutes, and the UI must read correctly when they
  are absent.
- **Finished sessions cannot be edited.** There is no update endpoint. The exit confirmation
  is the last chance to correct numbers.
- **Tasks are read-only** for ordinary users — no create, edit or delete anywhere in the UI.
- **The two AI modes are separate endpoints.** Draft & Review returns a plan pending
  confirmation and writes nothing until confirmed; declining discards it. Instant Create
  persists a routine as soon as the request succeeds. Drafts expire after 15 minutes, and
  confirming an expired draft returns nothing.
- **Lists are paginated** — tasks, routines and sessions. The routine picker cannot assume
  it has every routine.
- **Recordings:** MP3, WAV, M4A/MP4, OGG, WebM; 50 MB default cap. Playback uses a
  temporary URL requested per play, so an expired-link state is a real state, not an edge
  case. No waveform, transcription or scoring.
- **No analytics endpoint.** Home's "this week" is derived client-side: filter the user's
  sessions to the current week, count them, sum per-task minutes. Nothing beyond those two
  figures is honest.
