# 13 — New features (post-MVP)

**Status:** 13.1, 13.2 and 13.4 merged, awaiting device verification · 13.3 blocked · 13.5
not started ·
**Written:** 2026-10-04

## Progress — 2026-10-06 (resume here)

**Merged; not yet verified on a device:**

| PR                                                               | What                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [FE #32](https://github.com/alecoelhodev/guitarcoach-fe/pull/32) | 13.4: one border per input state, eye toggle, no autofill bleed on web    |
| [FE #33](https://github.com/alecoelhodev/guitarcoach-fe/pull/33) | Ask AI "Drafting your plan…" card (canvas 10b); form locked while pending |
| [BE #30](https://github.com/alecoelhodev/guitarcoach/pull/30)    | 13.2: `GET /tasks?q=`, LIKE wildcards escaped, `q` in the list cache key  |
| [FE #34](https://github.com/alecoelhodev/guitarcoach-fe/pull/34) | 13.2: Library search field, 300 ms debounce, count and empty-state copy   |
| [BE #31](https://github.com/alecoelhodev/guitarcoach/pull/31)    | 13.1: `PUT/GET/DELETE /users/me/avatar`, purge deletes the photo          |
| [FE #35](https://github.com/alecoelhodev/guitarcoach-fe/pull/35) | 13.1: pick, crop, resize and upload; shared `Avatar` on Profile and Home  |

**Device checklist** (Expo Go, `npm run dev:cloud`):

- [ ] **Inputs.** Sign-in email at rest, focused, invalid and autofilled (iOS and web): one
      border, no outer ring, no yellow autofill. The eye toggle is centred and swaps icons.
- [ ] **Ask AI.** Draft a plan: the card with three pulsing lines shows while waiting, the
      button reads "Drafting…", and the prompt, chips and mode switch are locked.
- [ ] **Library search.** Type quickly: one request per pause. Combine with a chip, scroll to
      page 2, then change the search: the list restarts. A no-match search shows its message.
- [ ] **Profile photo.** Choose a photo, then reload the app: it persists on Profile and Home.
      Remove brings the initials back. Delete an account that has a photo.

**Deviations from the text below:** the photo uses React Native's `Image`, not `expo-image`
(SDWebImage's pods and privacy manifest for one avatar), and tapping the avatar opens the
picker directly, with **Remove photo** under it, rather than a sheet: the repo has no sheet
primitive. Ask AI's loading state was reported on device and is not one of the four features.

**13.1 follow-ups, 2026-10-07:** on a device the photo pick did nothing and no upload reached
Cloud Run. [FE #38](https://github.com/alecoelhodev/guitarcoach-fe/pull/38) makes every outcome
visible ("Preparing photo…", a 20 s resize bound, and a dev-only Metro trace prefixed
`[avatar]`); retry once with Metro open and report the last `[avatar]` line. The email's
Gravatar is now the default photo when none is uploaded.

**Not started:** 13.5 (email reminders), written 2026-10-06. It waits on the decisions listed in
its own section.

Five features requested after the first release work; none blocks the first store submission
(spec 12). Suggested order: **13.4 → 13.2 → 13.1 → 13.3 → 13.5**. 13.3 waits on a Spotify policy
check and a product decision. 13.5 is backend-heavy and waits on an email provider and its own
product decisions.

Every backend change here goes in first, because frontend CI reads the backend's `main`; see
`docs/api-contract-workflow.md`.

---

## 13.1 Profile image

**Size:** M · **Depends on:** nothing · **Backend first:** yes

Users can set a profile photo. It replaces the initials avatar on Profile; canvas 11 draws initials
because there was no upload flow.

### Backend

- `User.image` already exists (`String?`, a better-auth field), so **no migration**. Store the
  GCS object name there, not a public URL.
- `PUT /api/v1/users/me/avatar` (multipart, any signed-in user):
  - JPEG, PNG or WebP only, max 2 MB. Validate the MIME type and size server-side.
  - Store it at `users/{userId}/avatar/{uuid}.{ext}` with the existing `GcpStorageService`.
  - Delete the previous avatar object after the new one is saved.
- `DELETE /api/v1/users/me/avatar` removes the object and clears `image`.
- `GET /users/me` exposes a short-lived signed URL, the same pattern as recordings' download URL,
  never the raw object name.
- `UsersService.purge` (account deletion) must also delete the avatar object.

### Frontend

- Tapping the Profile avatar opens a sheet with **Choose photo** and, if a photo is set, **Remove**.
- `expo-image-picker` with a square crop. It's in Expo Go's bundled set (`~57.0.12`); install with
  `npx expo install`.
- `expo-image-manipulator` (bundled, `~57.0.12`) resizes to 512 px and re-encodes as JPEG before
  upload.
- Display the photo with `expo-image` (bundled). Fall back to the existing initials while it loads,
  on error and when no photo is set.
- Upload through the existing `upload()` transport in `src/api/client.ts`, as recordings do.
- Only the photo-library permission. Configure its usage string in `app.config.ts` and add no
  camera or mic permission.

### Store and privacy

Add **photos** to App Privacy (iOS) and Data safety (Play), and to the privacy policy.

### Acceptance

- Choose, upload, reload: the photo persists. Remove brings the initials back.
- A file over 2 MB or a non-image file is rejected with a clear message.
- Deleting the account deletes the avatar object (backend e2e test with the fake GCS).

---

## 13.2 Library title search

**Size:** S–M · **Depends on:** nothing · **Backend first:** yes

The Library already filters by **category** and **difficulty** (spec 06). This adds a text search
on the task title.

### Backend

- Add an optional `q` to the `GET /tasks` query DTO: trimmed, 1–100 characters.
- Filter with Prisma `title: { contains: q, mode: 'insensitive' }`. Prisma parameterises it, so
  never build SQL by hand.
- Include `q` in the tasks list cache key, or searches would return cached unfiltered pages.
- Consider a trigram index (`pg_trgm`) only if the catalogue grows large enough for search to be
  measurably slow.

### Frontend

- A search `Input` above the chips, with a clear (×) button.
- Debounce 300 ms, then pass `q` into `useTasks` filters, so it lands in `queryKeys.tasks(...)` and
  each search is its own cache entry. Keep `placeholderData: keepPreviousData`.
- The count line includes the query, e.g. "3 tasks · 'pentatonic' · Technique".
- With no results: "No tasks match 'pentatonic'" and a **Clear** action that resets the search and
  chips together.

### Acceptance

- Typing quickly sends one request per pause, not per keystroke.
- Search combines with category and difficulty.
- Pagination still works on filtered results, and changing the search restarts at page 1.

---

## 13.3 Spotify-based task suggestions (in-app)

**Size:** L · **Depends on:** a product decision (below) · **Backend first:** yes

Every user can connect their Spotify account and get practice-task suggestions based on what they
listen to, e.g. "Learn the main riff of _Song_ by _Artist_".

Naming: this was raised as an "MCP". In the app it is a **Spotify integration**. An MCP server
would only be needed if Claude itself had to call it, and that's a separate, optional piece.

### Blocker: verify Spotify's API access first

**Unverified, so check it before any build.** Spotify's Web API starts every app in development
mode, which only allows a small allowlist of test users. Extended quota (public use) has reportedly
been limited to established organisations since 2025, and some endpoints (audio features,
recommendations) are closed to new apps. Confirm the current policy on developer.spotify.com. If
extended quota can't be obtained, the feature can only serve allowlisted testers, and is not worth
building for a public release.

### Product decision needed

Tasks are global and admin-only today. Where does an accepted suggestion go?

- **(a) Private user tasks (recommended).** Add `Task.ownerId`, so each user sees the shared
  library plus their own tasks. This is the deferred decision in spec 12 §4. It needs a migration,
  and the same visibility filter on every path that accepts a `taskId`.
- **(b) No new tasks.** Suggestions become a routine draft built from existing library tasks, with
  the song in the routine notes. Simpler, but loses the song-specific task.

### Backend

- New `SpotifyConnection` table (a migration): `userId`, an **encrypted** refresh token, scopes,
  timestamps. Never return the token to the client.
- `POST /api/v1/spotify/connect` exchanges the auth code **server-side**, so the client secret never
  ships in the app. `DELETE /api/v1/spotify/connect` deletes the row.
- `POST /api/v1/ai/spotify-suggestions`:
  - Reads the user's top or recently played tracks. Scopes: `user-top-read` and
    `user-read-recently-played`.
  - Sends **only** artist and track names to the existing AI planner, with no user identifiers.
  - Returns draft tasks the user reviews, the same Draft & Review shape as the AI Coach. Nothing is
    persisted until the user confirms.
- Rate-limit it like the other AI endpoints.
- `UsersService.purge` deletes the connection.

### Frontend

- Profile: **Connect Spotify** / **Disconnect**.
- OAuth Authorization Code with PKCE via `expo-auth-session` (bundled, `~57.0.8`) and
  `expo-web-browser` (bundled). The redirect URI must be registered in the Spotify dashboard for
  each environment.
- A "Suggestions from your listening" entry, on Coach or Library. It shows draft tasks the user
  accepts or dismisses.

### Store and privacy

New data category: **music listening history**. Update the privacy policy, App Privacy and Data
safety, and list Spotify as a third party.

### Acceptance

- Connect, then suggestions appear. Disconnect removes the stored token, and suggestions stop.
- No Spotify token appears in any response, log or Sentry event.
- Deleting the account removes the connection.

---

## 13.4 Sign-in / sign-up input polish

**Size:** S · **Depends on:** nothing

Two visual issues reported on the auth screens: **the email field's border looks odd**, and the
**password Show/Hide label** looks out of place.

Files: `src/features/auth/auth-form.tsx`, `src/components/ui/input.tsx`,
`src/components/ui/password-input.tsx`.

### Approach

1. **Reproduce first**, in iOS Expo Go and on web. Take screenshots at rest, focused, invalid and
   autofilled, and compare them with wireframe canvas 01.
2. Suspects, to confirm rather than assume:
   - **Email border.** `Input`'s focused style sets a 1.5 px border **and** an `outline*` focus
     ring, which can draw a double edge. On web, the browser's autofill background and border can
     override the tokens.
   - **Show/Hide.** The label is a `ThemedText` absolutely positioned over a full-height
     `Pressable`. Check its vertical centring against the input's 44 pt `minHeight`, its type size
     relative to the input text, and its contrast. Consider a lucide eye / eye-off icon with the
     existing accessibility labels instead of text.
3. Fix it in the shared primitives, so every form gets the fix, not only auth.

### Acceptance

- One border weight per state (rest, focus, invalid), with no double edge.
- The Show/Hide control is vertically centred, aligned with the input text, and still a 44 pt tap
  target.
- No autofill colour bleed on web.
- Existing auth-form and input tests pass. Add a test for the focused and invalid styles.

---

## 13.5 Email reminders

**Size:** L · **Depends on:** an email provider and the decisions below · **Backend first:** yes

Email a user when they have gone quiet, and when a routine is left incomplete.

### What exists today (verified 2026-10-06)

- **No email is actually sent.** The backend's `src/auth/email.ts` only `console.log`s the
  verification and password-reset links. A provider is a prerequisite, and wiring one also makes
  those two auth emails real.
- **The scheduling pattern exists.** `src/weekly-routine-cleanup/` is a standalone Cloud Run Job
  (its own `main.ts` and `env.validation.ts`) triggered by Cloud Scheduler. The backend's
  CLAUDE.md says to copy it rather than add an in-process timer.
- **"Incomplete" has data behind it:** `PracticeSessionTask.completed` per task, and
  `Routine.status` (`active` / `archived`).

### Triggers

- **Inactive.** No `PracticeSession` in the last _X_ days (default 7). At most one reminder per
  inactive stretch; the next one only after new activity.
- **Incomplete routine.** An active routine whose latest session left tasks with
  `completed = false`, or an active routine not practised for _X_ days. Decision 3 picks one.

### Backend

- **Provider:** an `EmailSender` interface behind a DI token, as `AiProvider` is wired, with the
  API key in Secret Manager. Point `auth/email.ts` at it too.
- **Daily batch job**, copying `weekly-routine-cleanup`:
  - Pages through candidates rather than loading every user.
  - Idempotent: a `NotificationLog` table (`userId`, `kind`, `sentAt`, unique per stretch) stops
    a retried run from sending twice.
- **Preferences:** a `NotificationPreference` table (per-kind opt-in, inactivity days), with
  `GET` / `PATCH /users/me/notifications`.
- **Unsubscribe:** every email carries a signed one-click link and a `List-Unsubscribe` header,
  and it works without signing in.
- **Content:** the user's name, the routine title and a deep link. No session notes, no
  recording links.
- **Account deletion:** `UsersService.purge` deletes the preferences and the log.

### Frontend

- Profile gets a **Notifications** section: a toggle per kind and the inactivity days.
- The email's deep link (scheme `guitarcoachfe`) opens the routine, or Home for the inactivity
  email.

### Store and privacy

The account email is now also used for reminders. Update the privacy policy, and App Privacy and
Data safety if the provider counts as a third party that receives data.

### Decisions needed

1. **Email provider**, e.g. Postmark, SendGrid or Resend. Compare pricing, and set up SPF and DKIM
   on the sending domain.
2. **Opt-in or opt-out by default.** Opt-in is the safer choice under app-store and anti-spam
   rules.
3. **What "incomplete routine" means:** the latest session had unfinished tasks, or the routine
   hasn't been practised for _X_ days.
4. **Is _X_ per user or one global setting?**

### Acceptance

- A run sends one email per inactive user per stretch; running it again sends nothing new.
- An opted-out user receives nothing.
- Unsubscribe works while signed out.
- Deleting the account removes the preferences and the log.
- e2e coverage with a fake `EmailSender`, as `FakeGcpStorageService` stands in for storage.
