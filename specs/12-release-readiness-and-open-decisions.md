# 12 — Release readiness and open decisions

**Status:** open · **Owner:** product owner (human-only steps) · **Written:** 2026-10-04

These are the release tasks no code change can finish: they need account access, a decision, or
artwork. Pre-release hardening (security, performance and store config) has already merged:
frontend PRs #17–#23, backend PRs #26–#28. That includes in-app account deletion and the
admin-only **New task** form, both verified on a device on 2026-10-04. Where Claude has follow-up
work once a step is done, the step says so.

Do section 1 first. Sections 2–4 can happen in any order. Section 5 must be complete before the
first store submission.

## 1. Security — do now

### 1.1 Seeded accounts in the production database

`prisma/seed.ts` in the backend creates `admin@`, `alice@`, `bob@`, `carol@` and
`dave@guitarcoach.dev`. They all share one password, which has been readable in the repo's public
git history. The seed now refuses to run against a non-local database unless
`SEED_ALLOW_NON_LOCAL=true` is set. That stops it happening again, but it can't tell whether it
already happened.

1. Query the production `users` table for those five emails.
2. If any exist, delete them, or rotate their passwords and revoke their sessions (`sessions` rows).

**Done when:** none of the five can sign in to production.

### 1.2 k6 test-user password

An example password for `K6_TEST_USER_PASSWORD` used to sit in the backend's
`docs/performance-testing.md`, and it's still in git history. The real value lives in Secret
Manager as `guitarcoach-k6-perf-test-password`.

1. Compare the two.
2. If they match, rotate the secret and the k6 user's password together.

**Done when:** the live k6 password doesn't appear anywhere in git history.

## 2. Verify on a device (Expo Go)

The unchecked items haven't run on a device yet; the automated suites can't prove them. Run
`npm run dev:cloud` and scan the QR.

- [ ] **Session notes draft.** Type in notes, switch to the title, background the app mid-draft,
      come back, then Finish. The saved session contains the latest text.
- [ ] **Minutes stepper.** Tap + rapidly 5 times, then reload. The final value persists. Clear a
      duration and reload: it stays cleared.
- [ ] **Offline sign-out.** In Airplane mode, sign out. The app returns to sign-in within about 2
      seconds, and the next account sees none of the previous one's data.
- [ ] **Session detail.** Task titles appear with no per-row spinner.
- [ ] **Offline History and Home.** Lists render from cache, with no session notes.
- [ ] **Links.** Every card or row that navigates actually navigates on native; see the
      `Link asChild` rules in `AGENTS.md`.
- [x] **Delete account.** Profile → Delete account → confirm lands on sign-in, and the account
      is gone. Verified 2026-10-04.
- [x] **New task (admin).** An admin sees **New task** in the Library, and the created task opens
      and lists. Verified 2026-10-04.

## 3. Turn on Sentry

The integration is merged (`src/lib/monitoring.ts`). Org `aga-projects` and project
`react-native` exist, and these EAS variables are set for both `preview` and `production`:
`SENTRY_ORG`, `SENTRY_PROJECT`, `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_SENTRY_ENVIRONMENT`.

**Left for you — before the next EAS build**, because with the org and project set, a native build
fails at the source-map upload without the token:

1. In Sentry, create an organization auth token (Settings → Organization Tokens).
2. Store it as an EAS secret. Paste it at the prompt; never share it or commit it:

   ```bash
   eas env:set --name SENTRY_AUTH_TOKEN --visibility secret \
     --environment preview --environment production
   ```

3. In a preview build, throw a test error.

**Done when:** the event shows up in Sentry with a symbolicated stack trace and an opaque user id
only, and no email, cookie or request body.

## 4. Open decisions

Each decision unblocks work that Claude can then do.

| Decision                                                              | Recommendation                          | Unblocks                                                      |
| --------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| **OTA updates** (`expo-updates`)                                      | Yes, after the first store release      | `runtimeVersion` policy and an EAS Update channel per profile |
| **Optimistic boot** (skip the 5s session check when a user is cached) | Yes, if cold starts feel slow on device | A change in `src/stores/session-store.ts`                     |
| **Pin GitHub Actions to commit SHAs**                                 | **In review**: FE #26, BE #29           | —                                                             |
| **Keep routine notes off the device**                                 | Optional. Session notes already are     | A `persist.ts` serializer change                              |
| **Edit and delete tasks in the app** (admin)                          | **In review**: FE #27, BE #29 (409 fix) | —                                                             |
| **User-created private tasks**                                        | Later, if users ask for it              | A backend `Task.ownerId` migration plus visibility filtering  |

### 4.1 Admin accounts

Only admins can create tasks, and there's no self-service way to become one. To make another
admin, run this against the production database, then have them sign out and back in:

```sql
UPDATE users SET role = 'admin' WHERE email = '<email>';
```

`DELETE /tasks/{id}` refuses a task that a routine or logged session uses. It used to rely on
Prisma's `P2003`, which Postgres 18 reports as `23001`, so the 409 came back as a 500. Backend #29
applies the same count-first fix that #27 gave routines.

## 5. Store prerequisites (before the first submission)

### 5.1 Identity

- **Decided** (2026-10-05): the display name is **Progress Pick** and the bundle/package ID is
  `com.coelhoadevsteam.progresspick` (FE PR "rename to Progress Pick"). The `slug`
  (`guitar-coach`), the deep-link scheme and the `guitar-coach.*` storage keys are deliberately
  unchanged, so the EAS project link and cached data survive. Use the new ID for the store
  records in 5.6.

### 5.2 Production API URL

Every build needs `EXPO_PUBLIC_API_BASE_URL` (https). Without it, the app throws on launch, and
production builds refuse plain http.

```bash
eas env:set --name EXPO_PUBLIC_API_BASE_URL --value https://<api-host> \
  --environment preview --environment production
```

### 5.3 Artwork

Every image in `assets/` is still the Expo template. Provide:

- an app icon, 1024×1024 PNG with no transparency
- Android adaptive icon layers: foreground and monochrome (keep the artwork inside the central
  ~66/108 dp safe zone), plus a background
- a splash mark, which goes on the existing `#0a0b0d` background
- a favicon
- optionally, an iOS Icon Composer bundle to replace `assets/expo.icon`

Claude then wires everything into `app.config.ts`.

### 5.4 Privacy policy and support URLs

Both stores require a privacy policy URL, and App Store Connect also needs a support URL. Host
both. Claude then adds links to the profile screen via `ExternalLink`.

- The privacy policy should say that **deleting the account in the app permanently removes** the
  account, routines, practice sessions, notes and recordings.
- **Google Play also requires an account-deletion URL outside the app**, for people who have
  already uninstalled it. A page explaining how to request deletion is enough, e.g. "email
  support from your account address". Enter it in the Play Console's Data safety form.

### 5.5 Listing copy and questionnaires

- Store description, keywords, category and age rating.
- Screenshots. Claude can capture them from the simulator on request.
- **App Privacy** (iOS) and **Data safety** (Play) answers, describing what the app actually
  handles:
  - account email and name
  - routines, practice sessions and notes, stored on the backend
  - audio recordings in Google Cloud Storage
  - a local cache on the device
  - crash reports, if Sentry is enabled
- Approve or replace the placeholder web copy in `src/app/+html.tsx` ("Progress Pick" / "Practice
  with a plan.").

### 5.6 Store accounts

- Create the App Store Connect app record, and note the `ascAppId` and Apple Team ID.
- Create the Play Console app and a service account. Keep the key in EAS or a secret manager,
  **never in the repo**.

Claude then fills in `eas.json` → `submit` with IDs only.

### 5.7 Web hosting (only if web ships)

Choose a host for the static `dist/` and configure security headers there: CSP, HSTS, and
`frame-ancestors`/`X-Frame-Options`.

## 6. Ship

1. Run `eas build --profile preview` for iOS and Android, and install it on devices.
2. Repeat the section 2 checklist on the preview build.
3. Run `eas build --profile production`, then `eas submit`.

## 7. Backlog — Claude can do these on request

None of these blocks the first release.

- **Bulk session delete orphans recordings in storage.** `deleteByTitle` in the backend's
  `practice-sessions.service.ts` removes the recording rows but not their GCS objects. Only the
  k6 load tests call it, so the leak is limited to test data. The fix is to reuse the
  delete-objects-after-commit pattern from `UsersService.purge`.
- **Let an admin clear a task's link, category or difficulty.** `UpdateTaskDto` accepts no
  `null`, so the edit form refuses to clear a saved value. Making those fields nullable is a
  backend-first change, followed by an `api:types` regeneration.
- **Unsaved-changes guard on New task.** Backing out of a half-filled form discards it silently,
  where the routine builder asks first. Low impact for an admin-only screen.
- **Stale branches.** Neither repo has branches left over from Claude's work. Both repos still
  have older branches of yours that look merged, e.g. `polish/ux-perf-hardening`; delete them
  when you're ready. Your unmerged `spec-05-add-to-routine` and `spec-07-practice-sheet` branches
  and the `guitar-coach-fe-session` worktree are untouched.
