# Manual QA report — 17 September 2026

Status: **Not ready for sign-off.** Manual testing found account isolation, native navigation,
upload, and session navigation defects. No application code was changed.

> **All ten defects below have since been fixed** — see [`FIXES.md`](FIXES.md) for what changed,
> what was verified, and what remains unverified (no interactive UI re-test was possible, and
> Android is still untested). This report is left as written, describing the state at `b987662`.
> The two "unfinished MVP paths" were deliberately not addressed: both are in flight on their
> own branches.

## Environment and scope

- Frontend: `b987662d858d022d7ec7ea167cc066b1377bdc76`.
- Backend checkout: `4f3b3fcff9df7ad3ffb0be024cd7f8107750842b` (the running local service was
  exercised; its image revision was not independently verified).
- iOS: iPhone 17 Pro simulator, iOS 26.5, Expo Go 57.0.9. The initially installed Expo Go was
  incompatible; it was updated from Expo's official SDK-specific download before testing.
- Web: Codex's Chromium-based in-app browser, mobile layouts (390 × 844 initially; subsequent captured viewport 349 × 735); additional desktop
  inspection at 1440 × 900. This is responsive web testing, not Android or Mobile Safari.
- Android: **not tested**. No SDK, emulator, or connected test device was available; the user
  confirmed they have no Android setup. No physical device was tested.
- Local test accounts: `qa.manual.20260917@example.com` and `qa.second.20260917@example.com`.
  Accounts were provisioned through the local API. UI signup success is not claimed.
- The real frontend and real local backend were used. A separate loopback-only API proxy on
  port 3001 supplied faults to a QA Expo server on port 8082. The original server on 8081 was
  not changed. The proxy forwarded normal requests and injected connection drops, four-second
  delays, HTTP 500/401 responses, or a connection that never answered.
- “Offline” below means the API connection was dropped while the app bundle remained
  available. Airplane mode, loss of the Metro connection, OS reachability transitions, and
  bandwidth throttling were not tested. Session expiry was simulated with API 401 responses;
  natural cookie expiration over time was not tested.
- All interactions described as manual were performed against the running UI. Source inspection
  was used afterward to identify likely causes. Unit tests and production export were not used
  as substitutes for manual testing and were not rerun for this report-only change.

## High-priority defects

### QA-01 — P1: A different account can resume and read the previous user's practice notes

**Confirmed:** web. Native uses the same store and logout handlers, but cross-account disclosure
was not independently reproduced on iOS.

1. Sign in as account A and start a routine.
2. Enter `PRIVATE QA ACCOUNT A NOTES` in session notes.
3. Return HTTP 401 to Finish Session. The app redirects to Sign In.
4. Restore the API and sign in as account B.
5. Account B's empty Home screen offers “Resume practice session?”. Select Resume.

**Actual:** account B sees A's routine title, tasks, minutes, and private unsaved notes.
**Expected:** an in-progress session must be scoped to its owner. Another account must never
receive the resume prompt or its contents. Same-user recovery can preserve progress safely.

The persisted `active-session` store has no owner identifier, and the unauthorized handler
clears auth/query caches without clearing or isolating active practice. Explicit sign-out has
that same omission by inspection. No cross-account session submission was attempted.

Relevant code: `src/features/session/session-store.ts:89`, `src/app/_layout.tsx:63`,
`src/api/auth.queries.ts:17`.

Evidence: [account B resume prompt](web-second-account-resume.jpg),
[account A notes visible after account B login](web-second-account-private-notes.jpg).

### QA-02 — P1: Native Library and History cards do not navigate

**Confirmed:** iOS simulator. The corresponding links worked on web.

1. Open Library; select Theory + Easy.
2. Tap the Circle of fifths card. Nothing happens.
3. Complete a practice session, open History, and tap its session card. Nothing happens.
4. Tapping the Home profile initial also produces no navigation.

**Expected:** task/session details and Profile open. The failed session link prevents ordinary
navigation to recordings. A direct deep link was necessary to continue native recording tests.

`TaskCard` and `SessionCard` place a `Card` directly under `Link asChild`; `Card` renders a
plain native `View`. The Home avatar similarly uses a plain View. These are not native pressable
controls. Routine list cards use `Pressable` and successfully opened their native editor.

Relevant code: `src/features/library/task-card.tsx:13`,
`src/features/history/session-card.tsx:17`, `src/components/ui/card.tsx:10`,
`src/features/home/home-screen.tsx:99`.

Evidence: [native Library after tapping the card](ios-library-link-no-action.jpg).
The unchanged accessibility tree after both semantic and coordinate taps corroborated the failure.

### QA-03 — P1: Web rejects a valid recording upload

**Confirmed:** web.

1. Open a saved practice session.
2. Choose a valid one-second PCM WAV: mono, 8 kHz, 16 bit, 16,044 bytes.
3. Wait for the upload.

**Actual:** “That file can't be uploaded”; no recording is added.
**Expected:** an allowed WAV under 50 MB uploads successfully.

The exact same file succeeded through the local API as multipart `audio/wav` and was then
playable from both UIs. This rules out the file and storage setup as the cause of this reproduction.
`upload()` appends the native `{ uri, name, type }` object to FormData on every platform. A browser
needs an actual File/Blob; the type assertion does not convert the object to file bytes.
`RecordingUpload` also drops the picker asset's browser File before calling the transport.

Relevant code: `src/api/client.ts:154`, `src/features/history/recording-upload.tsx:58`.
Evidence: [valid WAV rejected](web-valid-wav-rejected.jpg).

### QA-04 — P1: New users cannot reach manual routine creation from an empty Routines list

**Confirmed:** web, using the new QA account.

1. Sign in with no routines and open Routines → Active.
2. Observe only “No routines yet / Build one from the library or ask the coach.”
3. Create a routine through AI Coach and return to Routines.

**Actual:** Create Routine and the coach action appear only after a routine already exists.
**Expected:** both creation actions remain available in the empty state.

The actions are in the FlatList footer inside `QueryState`'s nonempty child, so the empty-state
branch removes the only manual creation entry point. Visiting the creation URL works, but is
not a discoverable workaround for a new user.

Relevant code: `src/features/routines/routines-list.tsx:49` and `:95`.

### QA-05 — P1: Starting practice produces spurious resume dialogs and broken post-save navigation

**Confirmed:** web; reproduced more than once.

1. Visit Home, navigate to a populated routine, and start practice.
2. A “Resume practice session?” dialog appears over the session just started.
3. Select Resume, complete the session, and finish successfully.

**Actual:** after saving, `/session/active` can remain visible as an empty “Practice session” with
0:00, no tasks, and an enabled Finish Session button. Repeating Home/start navigation produced
two simultaneous resume dialogs.
**Expected:** one active session screen, no recovery prompt for the session just started, and
navigation back to a meaningful screen after saving.

The Home resume prompt derives visibility from any active tasks without checking whether Home
is focused. Resume pushes another active-session route; Finish resets the store and uses
`router.back()`, which can expose a prior active-session screen with empty state.

Relevant code: `src/features/home/home-screen.tsx:60`, `:153`,
`src/features/session/active-session-screen.tsx:120`.
Evidence: [duplicate dialogs](web-duplicate-resume-dialogs.jpg),
[empty active screen after successful save](web-after-save-empty-session.jpg).

## Additional confirmed defects

### QA-06 — P2: Starting a zero-task routine opens “No active session”

**Confirmed:** web. Create a routine, add no tasks, and select the enabled Start Practice button.
The next screen says “No active session” and offers Go back. Either block starting with clear
instructions or support a real blank session. The editor currently advertises an action it cannot
complete. Relevant code: `src/features/session/active-session-screen.tsx:130`.

### QA-07 — P2: History groups sessions under the UTC day, while details show the local day

**Confirmed:** iOS. A session created on September 17 at about 8:22 PM New York time appeared
under `2026-09-18` in History. A later QA session's detail correctly displayed September 17,
8:23:20 PM. Evening sessions therefore appear under tomorrow's heading in this timezone.
`groupSessionsByDay` slices the UTC timestamp rather than deriving the local calendar date.
Relevant code: `src/lib/date-grouping.ts:23`.

### QA-08 — P2: Server errors are falsely reported as expired playback links

**Confirmed:** iOS and web. Inject HTTP 500 for `/api/v1/recordings/{id}/download-url`, then press
Play recording. Both platforms say “This playback link has expired.” The service has failed to
issue a link; no expired URL was involved. Restore the service and Get a new link successfully
recovers playback. Report server/connectivity errors accurately while preserving retry.
Relevant code: `src/features/history/recording-row.tsx:70` and `:152`.

### QA-09 — P2: Crossing the responsive breakpoint resets the coach form

**Confirmed:** web. Select Instant Create, enter a prompt, and resize from the mobile layout to
1440 × 900. The UI returns to Draft & Review with an empty prompt. In the observed run an
Instant Create request was pending; resizing also removed its visible pending state. User input
and the selected workflow should survive ordinary browser resizing.

### QA-10 — P2: An unresponsive API leaves coach submission disabled without a recovery action

**Confirmed:** web; still pending after **122 seconds** at a fixed 1440 × 900 viewport.
A loopback proxy accepted the Instant Create request but never returned a response.
The form remained pending, with no cancellation or retry affordance. The shared transport only
creates an AbortController when `timeoutMs` is provided; coach calls do not provide one.
Relevant code: `src/api/client.ts:100`, `src/api/coach.ts:30`.
Evidence: [unresponsive coach after 122 seconds](web-unresponsive-coach.jpg).

## Known unfinished MVP paths observed in the UI

These are already described as open work in `specs/`; they are included because the requested
whole-application loop cannot pass with them missing.

- **Library → Add to Routine:** task detail has no Add to Routine control. Home tells a new user
  to build from the library, but that path ends at a read-only task detail. Adding tasks from an
  existing routine editor works. See spec 05 and `src/features/library/task-detail.tsx`.
- **Blank practice:** Home advertises “Or just play / Start a blank session and pick tasks as you
  go,” but the card has no action. The web Practice navigation leads to Routines. See spec 07 and
  `src/features/home/home-empty-state.tsx:40`.

## Coverage ledger

| Scenario                                      | Web                                                        | iOS simulator                                                                  |
| --------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Wrong login credentials                       | Correct inline error                                       | Incorrect-credentials response observed before switching to isolated local API |
| Successful local login                        | Passed                                                     | Passed                                                                         |
| Combined category/difficulty filters          | Passed Theory + Easy                                       | Passed Theory + Easy and Repertoire + Hard                                     |
| Task detail navigation                        | Passed                                                     | Failed: QA-02                                                                  |
| New-user Home and empty Routines              | Gaps + QA-04                                               | Not separately repeated with a new native account                              |
| AI Draft & Review generation and confirmation | Passed, five-task blues routine saved                      | Not exercised                                                                  |
| Manual routine creation / required title      | Passed                                                     | Existing routine editing exercised                                             |
| Add two tasks / duration / reorder            | Passed                                                     | Editor loaded; full management not repeated                                    |
| Archive and restore                           | Passed                                                     | Not exercised                                                                  |
| Unsaved routine warning / Keep editing        | Not separately exercised                                   | Passed; original title restored and saved                                      |
| Empty routine practice                        | Failed: QA-06                                              | Not repeated                                                                   |
| Practice checkbox / minutes / finish          | Passed, with navigation failure QA-05                      | Passed; 31 minutes and 1/5 completed shown                                     |
| Practice reload persistence                   | Timer and tasks survived                                   | Cold app relaunch tested after completed session, not active-session recovery  |
| HTTP 500 during practice save                 | Error; notes/tasks retained                                | Library query 500 tested instead                                               |
| Dropped connection during practice save       | Error; notes/tasks retained                                | Library drop/retry tested instead                                              |
| Four-second delay                             | Save disabled during request, eventually saved             | Library retry loaded successfully after delay                                  |
| API 401                                       | Returned to sign-in                                        | Returned to sign-in                                                            |
| Different user after API 401                  | Failed: QA-01                                              | Not independently tested                                                       |
| Offline cold start                            | Cached identity retained; connection error displayed       | Cached identity retained; connection error displayed                           |
| Reconnect                                     | Recovered data                                             | Try again recovered data                                                       |
| History list and detail                       | Detail and notes rendered; absent minutes shown as em dash | List rendered; card navigation failed; deep-link detail rendered               |
| Recording upload                              | Failed: QA-03                                              | Picker upload not tested                                                       |
| Synthetic recording playback                  | Pause state observed, playback recovered after error       | Reached 0:01 / 0:01; retry recovered                                           |
| Failed recording URL                          | Retry works; message wrong (QA-08)                         | Same                                                                           |
| Explicit sign-out                             | Passed                                                     | Not separately exercised                                                       |
| Responsive layouts                            | Mobile and desktop inspected; QA-09                        | Portrait iPhone only                                                           |

Additional final check: AI **Instant Create** succeeded after restoring the real API.
`QA Instant Theory` appeared in Routines with two tasks and 10 minutes.

## Limits and remaining checks

This was a broad exploratory manual pass, **not exhaustive cross-platform certification**.
Android and physical-device coverage remain unavailable. Mobile Safari, tablet/landscape,
VoiceOver/TalkBack, native file picking and microphone permissions, real packet throttling,
auth email delivery/password reset, natural credential expiry, all pagination boundaries,
recording deletion, routine deletion, all 404/409/413/429 variants, and every long-text/keyboard
combination were not fully covered. No claim of passing those scenarios is made.

The local QA accounts/routines/sessions were intentionally kept to make reproductions inspectable.
The one synthetic recording was created through the backend storage integration. No ordinary-user
data was edited. Test server cleanup and any final test outcomes are noted below.

## Cleanup

The QA proxy and QA Expo server were stopped, the simulator was shut down, and the temporary
API cookie jar was removed. The original development server on port 8081 was left running.
The browser viewport override was reset. Test data remains available in the dedicated accounts.
Only this report and its screenshots were added to the repository.
