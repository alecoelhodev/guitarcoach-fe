# 09 — Recordings: upload

**Status:** not started · **Size:** M · **Depends on:** 01 · **Wireframes:** canvas 09, 09b, 2e

Recordings can be **played** (`recording-row.tsx` uses `expo-audio`'s `useAudioPlayer` and fetches
a fresh signed URL per play) but never **created**. `uploadRecording` exists in
`src/api/recordings.ts` with a passing transport test and zero callers. Today a user can only hear
recordings that were uploaded by some other client — which, in practice, means never.

## Scope

Add an **Upload recording** action to the session detail (`src/features/history/session-detail.tsx`),
per canvas 09. Recordings attach to a **finished** session (`POST
/practice-sessions/{sessionId}/recordings`), so session detail is the right home — not the active
session screen, which has no session id yet.

### Picking a file

Use **`expo-document-picker`** — already a dependency, already in Expo Go's bundled set. Constrain
it to audio types.

Validate before uploading with the existing `validateRecordingFile` in `src/lib/file-validation.ts`;
it already mirrors the backend's allowed list and 50 MB cap. Keep the two in sync — the backend's
list lives in `src/practice-sessions/recordings/recording-file-filter.ts`.

### Uploading

- `useUploadRecording(sessionId)` from spec 01, over the existing `upload()` helper in
  `src/api/client.ts`. Multipart, **field name `file`** — the backend's `FileInterceptor('file')`
  rejects anything else.
- Footer copy, per canvas 09: "MP3, WAV, M4A, OGG or WebM · up to 50 MB".

### States (canvas 09b)

| State                  | Behaviour                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Uploading              | Filename, percentage, progress bar, "Cancel upload"                                                                      |
| Done                   | Toast "Recording added"; the list refreshes                                                                              |
| Wrong type / too large | "That file can't be uploaded" + the allowed-formats line + Choose another. Catch this **client-side** before the request |
| Failed                 | "Upload didn't finish" + Retry upload                                                                                    |
| Empty                  | "No recordings for this session. Upload one to hear it back later."                                                      |

**On progress and cancel — be honest.** `fetch` in React Native gives no upload-progress events,
and `src/api/client.ts`'s `upload()` is `fetch`-based. Either:

- wire real progress and cancellation with `expo-file-system`'s upload API (already a dependency)
  and an `AbortController`; **or**
- show an indeterminate progress indicator and drop the Cancel button.

Do **not** animate a fake percentage. Pick one, and say which in the PR.

## Out of scope

- **Recording audio in-app.** `expo-audio` can record, but no wireframe shows a recorder UI —
  canvas 07's "Add Recording" button and canvas 09's "Upload recording" both attach an existing
  file. Building a recorder is new functionality. See `11-blocked-and-out-of-scope.md`.
- The web drag-and-drop **drop zone** (canvas 2e) — a genuinely web-only nicety, not MVP.

## Acceptance

- [ ] A valid audio file uploads to the correct session and appears in its list.
- [ ] An oversized or wrong-type file is rejected client-side with the designed copy, no request.
- [ ] A failed upload offers Retry and leaves no phantom row.
- [ ] Progress is either real or indeterminate — never simulated.
- [ ] `tsc`, `expo lint`, `biome ci`, `npm test` clean. Note `expo-audio` is mocked in
      `jest.setup.ts`; re-point the hooks per test rather than removing the mock.
