# 12 — Release readiness and open decisions

**Status:** in progress (see Progress below) · **Owner:** product owner (human-only steps) · **Written:** 2026-10-04

These are the release tasks no code change can finish: they need account access, a decision, or
artwork. Pre-release hardening (security, performance and store config) has already merged:
frontend PRs #17–#23, backend PRs #26–#28. That includes in-app account deletion and the
admin-only **New task** form, both verified on a device on 2026-10-04. Where Claude has follow-up
work once a step is done, the step says so.

Do section 1 first. Sections 2–4 can happen in any order. Section 5 must be complete before the
first store submission.

## Progress — 2026-10-06 (resume here)

**Done, merged and verified on a device on 2026-10-06:**

| PR                                                               | What                                                                                     |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [BE #29](https://github.com/alecoelhodev/guitarcoach/pull/29)    | `DELETE /tasks/{id}` counts references first: 409 instead of 500. Actions pinned to SHAs |
| [FE #26](https://github.com/alecoelhodev/guitarcoach-fe/pull/26) | `contract.yml` actions pinned to SHAs                                                    |
| [FE #27](https://github.com/alecoelhodev/guitarcoach-fe/pull/27) | Admin Edit (`/library/[id]/edit`) and Delete on task detail                              |
| [FE #28](https://github.com/alecoelhodev/guitarcoach-fe/pull/28) | Renamed to **Progress Pick**, ID `com.coelhoadevsteam.progresspick` (see 5.1)            |
| [FE #30](https://github.com/alecoelhodev/guitarcoach-fe/pull/30) | App icon, Android adaptive layers, splash and favicon (see 5.3)                          |

The section 2 device checklist is complete.

**Next, all human-only, in order:**

1. Section 1: seeded production accounts and the k6 password.
2. Section 3: the Sentry auth token as an EAS secret — **every EAS build fails without it**.
3. 5.2: `EXPO_PUBLIC_API_BASE_URL` for `preview` and `production`.
4. 5.4–5.6: privacy, support and deletion URLs; listing copy; store records with the new ID.
5. Section 6: the preview build — the first place the real home-screen icon appears.

**Claude-doable when you want:** the undecided rows in section 4, and the section 7 backlog
(nullable `UpdateTaskDto` fields are done: BE #35).

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

All items have run on a device; the automated suites can't prove them, so repeat them on the
preview build (section 6). Run `npm run dev:cloud` and scan the QR.

- [x] **Session notes draft.** Type in notes, switch to the title, background the app mid-draft,
      come back, then Finish. The saved session contains the latest text. Verified 2026-10-06.
- [x] **Minutes stepper.** Tap + rapidly 5 times, then reload. The final value persists. Clear a
      duration and reload: it stays cleared. Verified 2026-10-06.
- [x] **Offline sign-out.** In Airplane mode, sign out. The app returns to sign-in within about 2
      seconds, and the next account sees none of the previous one's data. Verified 2026-10-06.
- [x] **Session detail.** Task titles appear with no per-row spinner. Verified 2026-10-06.
- [x] **Offline History and Home.** Lists render from cache, with no session notes. Verified
      2026-10-06.
- [x] **Links.** Every card or row that navigates actually navigates on native; see the
      `Link asChild` rules in `AGENTS.md`. Verified 2026-10-06.
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
| **Pin GitHub Actions to commit SHAs**                                 | **Done**: FE #26, BE #29                | —                                                             |
| **Keep routine notes off the device**                                 | Optional. Session notes already are     | A `persist.ts` serializer change                              |
| **Edit and delete tasks in the app** (admin)                          | **Done**: FE #27, BE #29 (409 fix)      | —                                                             |
| **User-created private tasks**                                        | Partly done: AI-created tasks (13.6)    | Extending `Task.ownerId` to a user-facing "New task"          |

### 4.1 Admin accounts

Only admins can create tasks, and there's no self-service way to become one. To make another
admin, run this against the production database, then have them sign out and back in:

```sql
UPDATE users SET role = 'admin' WHERE email = '<email>';
```

`DELETE /tasks/{id}` refuses a task that a routine or logged session uses. It used to rely on
Prisma's `P2003`, which Postgres 18 reports as `23001`, so the 409 came back as a 500. Backend #29
(merged) applies the same count-first fix that #27 gave routines.

## 5. Store prerequisites (before the first submission)

### 5.1 Identity

- **Done** (FE #28, verified 2026-10-06): the display name is **Progress Pick** and the
  bundle/package ID is `com.coelhoadevsteam.progresspick`. The `slug`
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

**Done** (FE #30; splash and favicon verified 2026-10-06): the Progress Pick logo
(`wireframes/1e-progress-pick/`, dark variant) is rendered into `assets/images/`: an opaque 1024
icon, Android foreground and monochrome layers inside the safe zone over a `#0a0b0d` background
colour, a splash mark and a 48px favicon.
`ios.icon` now falls back to the PNG; the template `assets/expo.icon` bundle is removed. Still
optional: an Icon Composer bundle for iOS 26's layered icon. The home-screen icon itself first
appears in the section 6 preview build, since Expo Go shows its own. The original request was:

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
  - an optional profile photo in Google Cloud Storage (**photos**: App Privacy "Photos or
    Videos", Data safety "Photos"), picked from the library only
  - a SHA-256 hash of the account email sent to **Gravatar** (a third party) to show its photo
    when none was uploaded
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
- ~~**Let an admin clear a task's link, category or difficulty.**~~ **Done** 2026-10-08
  (BE #35): `null` clears them, and the Edit screen sends it.
- **Unsaved-changes guard on New task.** Backing out of a half-filled form discards it silently,
  where the routine builder asks first. Low impact for an admin-only screen.
- **Stale branches.** Neither repo has branches left over from Claude's work. Both repos still
  have older branches of yours that look merged, e.g. `polish/ux-perf-hardening`; delete them
  when you're ready. Your unmerged `spec-05-add-to-routine` and `spec-07-practice-sheet` branches
  and the `guitar-coach-fe-session` worktree are untouched.
