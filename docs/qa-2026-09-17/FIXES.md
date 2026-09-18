# Resolution of the 17 September 2026 manual QA pass

Companion to [`REPORT.md`](REPORT.md). Every finding in that report was re-verified against the
code at `b987662` before being changed; all ten reproduced in source, so none was stale.

Two were **broader than reported** and one was **already a documented gap**:

- **QA-02 is a class, not three instances.** Five call sites put a non-pressable child under
  `<Link asChild>`, not the three that were found by hand. SDK 57's Link docs require the child
  to "accept `onPress` or `onClick`"; React Native's `View` accepts neither, while
  `react-native-web`'s `View` honours the injected DOM props — which is precisely why web passed
  and Expo Go failed.
- **The suite could not see QA-02 at all.** The shared router mock returned the `asChild` child
  unchanged, so `linkHrefs` proved a `Link` had been _rendered_, never that it could be
  _pressed_. Fixing the mock is what turned these into regression tests.
- **QA-07 was recorded as a known gap** in `docs/MIGRATION-PLAN.md`, with the old behaviour
  pinned by its own test, waiting on a product call about which day an evening session belongs
  to. QA made that call; the entry is now marked resolved.

## What changed

| Finding                                                   | Root cause                                                                                                                                                                                    | Fix                                                                                                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **QA-01** cross-account practice notes                    | `active-session` persists under one device-wide key with no owner; the 401 handler and `useSignOut` each cleared three things and both missed it                                              | `userId` on the store, checked by every reader; `persist` `version: 1` + `migrate` drops unowned v0 sessions; one shared `clearLocalSession()` used by both sign-out paths |
| **QA-02** native cards do not navigate                    | `Card` rendered a plain `View`, which drops a forwarded `onPress`                                                                                                                             | `Card` renders a `Pressable` when given `onPress`; the two bare-`View` children became `Pressable`; rule added to `AGENTS.md`                                              |
| **QA-03** web rejects a valid WAV                         | `upload()` appended a `{uri,name,type}` object, which a browser's `FormData` stringifies to `"[object Object]"` → 400 → "That file can't be uploaded"; the picker's real `File` was discarded | `upload()` prefers `asset.file` (web-only in SDK 57) and keeps the RN object form otherwise; `base64: false` so a 50 MB pick is not re-encoded as a data URL               |
| **QA-04** no way to create a routine when empty           | Both CTAs lived in the `FlatList` footer, and `QueryState`'s `empty` branch returns before `children` runs                                                                                    | CTAs extracted and rendered in both the footer and the Active empty state; Archived still offers none, which is deliberate                                                 |
| **QA-05** duplicate resume dialogs; dead post-save screen | Prompt keyed only on `tasks.length > 0` with no route check; `router.back()` is a no-op with nothing to pop, and the empty state was latched at mount                                         | Prompt suppressed while `/session/active` is the route; `leave()` falls back to `replace`; empty state derived rather than latched                                         |
| **QA-06** zero-task routine → "No active session"         | Start Practice was enabled on an empty routine                                                                                                                                                | Disabled with an explanation, in the builder and on the card. Deliberately does **not** touch the session screen's empty branch — blank practice is spec 07                |
| **QA-07** UTC day vs local day                            | `createdAt.slice(0, 10)` keyed on the UTC date while `filterThisWeek` used local time                                                                                                         | Grouped on the viewer's calendar day via `Intl.DateTimeFormat` numeric parts, with an injectable `timeZone` so it is testable under the `TZ=UTC` pin                       |
| **QA-08** server errors called expired links              | A bare `catch` set one flag, and the copy was hardcoded                                                                                                                                       | Transport failures render `describeError`; the expired wording is kept only for a player error on an already-issued URL                                                    |
| **QA-09** breakpoint resets the coach form                | `app-shell.web.tsx` returned two structurally different child arrays, remounting everything below it                                                                                          | One tree with three fixed slots, so the content `View` never changes position or type                                                                                      |
| **QA-10** unresponsive coach, no recovery                 | No `timeoutMs`, so the transport armed no `AbortController` — **and** the screen had no error handling at all, so a rejection was an unhandled promise and showed nothing                     | 60s ceiling on all three coach calls, plus an `ErrorPanel` with retry; the `cancelled` status no longer falls through silently                                             |

Two defects adjacent to the above were fixed because the reported one is invisible without them:
the coach screen's total absence of error handling (QA-10) and the planner's unhandled
`cancelled` status.

## Verified

- `npx tsc --noEmit` — 0 errors.
- `npx expo lint` — 0 errors (warnings unchanged in kind: the repo's `jest.mock`-above-imports
  pattern, 180 → 186 with the new suite).
- `npx biome ci .` — clean.
- `npm run test:coverage` — **52 suites, 676 tests passing**, coverage 96.1 / 93.2 / 95.3 / 97.0
  against a floor of 80. Was 51 suites / 643 tests.
- Each regression test was confirmed to **fail against the unfixed code** before being kept —
  including the two that initially passed either way and had to be rewritten (see below).
- `npx expo export -p web --clear` — exits 0.
- `npx expo export -p ios --clear` — exits 0, and the emitted bundle contains the new code, so
  the whole native module graph resolves and compiles.
- Both the web and iOS **development** bundles compile through Metro (`dev=true`), which is the
  mode that surfaces the `<Link asChild>` Slot throws a production export hides.

### `fireEvent.press` is not evidence, and that matters here

The first QA-02 regression tests passed with and without the fix: RNTL invokes an `onPress` prop
wherever it finds one, including on a plain `View` that React Native would never deliver a press
to. `src/test/press.ts` (`pressLinkTarget`) closes that gap by requiring the element to actually
claim the touch responder, which is RN's own contract. It is deliberately not used for a `Text`
child, which handles press without those props.

## Not verified

- **Android: not tested, and no Android result is claimed.** No SDK, emulator or device.
- **No interactive UI re-test was performed.** Browser automation was unavailable in this
  session and no simulator driver exists, so the UI claims above rest on the test suite, the
  type checker and the two full-graph compiles — not on hands-on use. The report's original
  reproductions have not been re-walked by hand.
- **Recording upload on web is the weakest of the ten.** The browser `FormData` behaviour is
  reproduced in a test (`client.test.ts` asserts the object form coerces to `"[object Object]"`
  in a DOM `FormData`, which is the bug, and that a `Blob` survives), but no real browser picked
  a real file. Worth a manual pass before sign-off.
- **QA-01's read-time guard is tested; the cross-account walkthrough is not re-walked.** The
  teardown, the migration and both read guards have tests; the five-step reproduction from the
  report was not repeated against a live backend.
- Mobile Safari, tablet/landscape, VoiceOver/TalkBack, physical devices, real throttling, and
  everything else the report listed as uncovered remain uncovered.

## Left alone

The report's two "known unfinished MVP paths" are **specs 05 and 07**, and both are already
implemented on unmerged branches — `origin/spec-05-add-to-routine` and
`origin/spec-07-practice-sheet`, the former checked out in a sibling worktree. Library → Add to
Routine and blank sessions were therefore not touched.

Those branches are stale against `main` (they predate `src/api/base-url.ts`) and will conflict
with this work in: `src/features/session/session-store.ts`,
`src/features/session/active-session-screen.tsx`, `src/api/client.ts`. Rebase deliberately —
QA-01's owner stamp and QA-05's derived empty state both live in files spec 07 rewrites.

## Manual re-test script

A local backend is running (`../guitar-coach`, `compose.dev.yaml`) with the web dev server on
`:8081`, which is the only origin in its `CORS_ORIGINS`. Two accounts were provisioned for this
work, password `QaFixPass123!`:

- `qa.fix.a.20260917@example.com` — seeded with **QA Fix Routine** (one task, 15 min) and
  **QA Empty Routine** (no tasks, for QA-06).
- `qa.fix.b.20260917@example.com` — empty, for the QA-01 second-account check.

1. **QA-01** — sign in as A, start QA Fix Routine, type notes, sign out, sign in as B. B's Home
   must offer no resume prompt.
2. **QA-02** — in Expo Go, tap a Library task card, a History session card, the Home avatar, a
   routine strip tile.
3. **QA-03** — open a saved session, upload a small WAV.
4. **QA-04** — sign in as B and open Routines → Active: both CTAs must be present.
5. **QA-05** — start practice from Home (no dialog should appear over it), finish, then reload
   `/session/active` directly and finish again.
6. **QA-06** — open QA Empty Routine: Start Practice disabled, with the reason shown.
7. **QA-09** — type a coach prompt, resize across 768px, confirm the text survives.
