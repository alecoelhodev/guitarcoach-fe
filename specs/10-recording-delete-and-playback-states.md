# 10 — Recordings: delete & playback edge states

**Status:** not started · **Size:** S · **Depends on:** 01 · **Wireframes:** canvas 09b, 2e

Small companion to spec 09. `deleteRecording` exists in the transport layer with no caller, and
playback has one unhandled state that the design explicitly calls out.

## Scope

### Delete

- A **Delete** action on each recording row → `useDeleteRecording(sessionId)`.
- Confirm first (canvas 09b): "Delete '`<filename>`'?" / "The audio is removed for good." →
  Delete / Cancel. That copy is accurate — the backend removes the GCS object as well as the row.
- Destructive, so it goes last and never sits adjacent to the confirm (canvas 1h).
- Stop playback if the recording being deleted is the one playing.

### Expired playback link

`GET /recordings/{id}/download-url` returns a URL that expires after **900s (15 min)**.
`recording-row.tsx` correctly requests a fresh one per play, but a URL can still lapse mid-playback
on a long file, and a fetched URL can fail.

- Handle the failure per canvas 09b: "This playback link has expired." + **Get a new link**, which
  re-requests and resumes.
- Don't pre-fetch URLs for every row on mount — that burns 15-minute URLs on recordings nobody
  plays. Per-play fetching is already correct; keep it.

## Acceptance

- [ ] Delete is confirmed, removes the row, and stops playback if that row was playing.
- [ ] Cancelling the dialog deletes nothing.
- [ ] A failed or expired playback URL offers Get a new link rather than failing silently.
- [ ] `tsc`, `expo lint`, `biome ci`, `npm test` clean.
