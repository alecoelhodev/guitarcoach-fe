# Monorepo migration — handoff

## Why

Two separate repos (`guitar-coach-fe`, `guitar-coach`) coordinate through a hand-built
cross-repo contract-sync pipeline (`plan/API-CONTRACT-SYNC.md`): the backend commits
`openapi.json`, the frontend's CI checks that repo out into a `backend/` subdirectory and
generates types from it. This works, but every API change now needs two PRs merged in the
right order, and the cross-repo checkout has already caused two real incidents:

1. A frontend PR failed because the backend PR hadn't been pushed to `guitarcoach`'s `main`
   yet — the checkout found no `openapi.json` at all.
2. `tsc --noEmit` (the last step of `api:types:check`) recursed into the checked-out
   `backend/` directory and tried to type-check the entire NestJS app with none of its
   dependencies installed, producing ~2,000 unrelated "Cannot find module" errors. Fixed by
   excluding `backend` in `tsconfig.json`, but it's a symptom of forcing a monorepo-shaped
   problem (one contract, two codebases) through polyrepo tooling.

For a single person working across both sides, a monorepo removes the coordination
overhead directly: one PR per feature, no sibling-path assumption (`../guitar-coach`), and
the contract check becomes a local file read instead of a cross-repo GitHub Actions
checkout. The cost is a one-time migration plus permanently mixing two different toolchains
(NestJS/Node vs Expo/React Native) in one repo — worth it here because there's no second
team member who only touches one side.

**Recommended tool: npm workspaces.** No new tooling to learn (already on npm), no build
system to configure. Revisit Turborepo/Nx only if build times or task orchestration
actually become a problem — with two apps and no shared internal packages yet, that's
unlikely to matter for a while.

## Target structure

Create a **new** repo (e.g. `guitar-coach`, retiring the current backend repo's name, or a
new `guitar-coach-monorepo` if you'd rather keep both old repos' names free) rather than
converting one of the two existing repos in place. Either old repo stays fully functional
and deployable until the new one is verified — if anything goes wrong there's no rollback
to perform, you just keep using what already works.

```
guitar-coach/                      (new repo root)
├── package.json                   # root: "workspaces": ["apps/*"], orchestration scripts only
├── apps/
│   ├── backend/                   # current guitar-coach, history preserved
│   │   ├── package.json
│   │   ├── openapi.json
│   │   └── src/...
│   └── frontend/                  # current guitar-coach-fe, history preserved
│       ├── package.json
│       ├── src/types/api.d.ts
│       └── ...
└── .github/workflows/
    ├── backend-ci.yml             # was ci.yml, now path-filtered
    ├── backend-deploy.yml         # was google-cloudrun-docker.yml, now path-filtered
    ├── frontend-ci.yml            # new: lint/format/tsc for the frontend on its own PRs
    └── contract-check.yml         # replaces contract.yml — no cross-repo checkout at all
```

## Migrating history (not a copy-paste)

Preserve both repos' git history and blame rather than starting fresh. `git subtree` needs
no extra tooling beyond git itself:

```bash
mkdir guitar-coach && cd guitar-coach && git init

git remote add backend-origin <path-or-url-to-guitar-coach>
git fetch backend-origin
git merge --allow-unrelated-histories -m "Import backend history" backend-origin/main
mkdir apps
git mv $(git ls-tree --name-only backend-origin/main) apps/backend/ 2>/dev/null || true
# (mv everything except .git into apps/backend/, commit)

git remote add frontend-origin <path-or-url-to-guitar-coach-fe>
git fetch frontend-origin
git merge --allow-unrelated-histories -m "Import frontend history" frontend-origin/main
# same move into apps/frontend/, commit
```

The exact move step needs care (you want every tracked file relocated under `apps/backend/`
or `apps/frontend/` in one commit per side, keeping history attached) — `git mv` each
top-level entry individually rather than trying to script it blindly. Do this on a throwaway
branch first and inspect `git log --follow` on a couple of frequently-changed files (e.g.
`src/tasks/tasks.service.ts`, `app/_layout.tsx`) to confirm history actually survived before
committing to the approach.

## What gets simpler

**Contract sync collapses to a local file read.** `apps/frontend/package.json`'s `api:types`
script changes from a sibling-path guess to a fixed in-repo path:

```jsonc
"api:types": "openapi-typescript ../backend/openapi.json -o src/types/api.d.ts"
```

`contract-check.yml` no longer checks out a second repository at all — it's just `npm ci`
(one workspace install) then `npm run api:types:check --workspace=apps/frontend`. The
`BACKEND_OPENAPI_PATH` env var and the whole "Check out backend" step in
`.github/workflows/contract.yml` go away. `api:types:remote` (pointing at
`$EXPO_PUBLIC_API_BASE_URL/docs-json`) stays useful as-is for testing against the deployed
Cloud Run service without a local backend checkout.

**No more `../guitar-coach` sibling-directory assumption** for local dev — `apps/backend`
and `apps/frontend` are always next to each other.

## What needs care

**CI must be path-filtered, or every change redeploys everything.** The backend's
`google-cloudrun-docker.yml` deploys to the live Cloud Run service on every push to `main`
— in a monorepo, a frontend-only commit must NOT trigger that. Add `paths:` filters to each
workflow:

```yaml
# backend-deploy.yml
on:
  push:
    branches: [main]
    paths: ['apps/backend/**']

# backend-ci.yml
on:
  pull_request:
    branches: [main]
    paths: ['apps/backend/**']

# frontend-ci.yml
on:
  pull_request:
    branches: [main]
    paths: ['apps/frontend/**']
```

`contract-check.yml` should run on **either** side changing (a backend DTO change and a
frontend type re-point both need the check), so leave it unfiltered or filter on
`['apps/backend/**', 'apps/frontend/**']` explicitly rather than omitting `paths` (omitting
it is equivalent but less self-documenting once there are several workflows in one repo).

**Docker build context changes.** The backend's `Dockerfile` currently assumes it's built
from the repo root; in the monorepo it needs to build from `apps/backend` (or from the repo
root with an adjusted `COPY` context so the Dockerfile can still resolve workspace-hoisted
`node_modules` if backend deps get hoisted to the root — decide whether to keep backend
deps un-hoisted, e.g. via `npm workspaces` config or a `.npmrc` `hoist=false`-equivalent, to
keep the Docker build simple and match today's behavior).

**Metro (Expo/RN bundler) and monorepos have known friction.** Metro's default module
resolution doesn't always follow npm workspace hoisting correctly. Before merging, check the
Expo SDK 57 docs (per `AGENTS.md`) for the monorepo guidance — typically this means setting
`watchFolders` to include the workspace root and `disableHierarchicalLookup` in
`metro.config.js`. Verify this against a real `expo start` before treating the migration as
done; a subtle Metro resolution bug is the most likely thing to eat time here.

**`.npmrc`'s `legacy-peer-deps=true`** (needed today because `openapi-typescript@7.13.0`
hasn't caught up to TypeScript 6) becomes a root-level setting affecting both workspaces'
installs. Confirm the backend's own dependency tree still installs cleanly under it — it
currently installs without needing that flag, so this is a change in its install behavior
too, not just the frontend's.

**Two `node_modules` trees become one (mostly).** npm workspaces hoists shared deps
(`typescript`, `zod`, etc. appear in both `package.json`s already) to the root
`node_modules`, with per-app overrides staying local when versions conflict. Run a full
install and diff `npm ls` output for anything that resolves to an unexpected version before
trusting it.

## Order of work

1. Create the new repo, import both histories under `apps/backend` and `apps/frontend`
   (throwaway branch first, verify `git log --follow` survives).
2. Add the root `package.json` with `"workspaces": ["apps/*"]`; run `npm install` once from
   the root; fix whatever hoisting surprises `npm ls` reveals.
3. Adjust `metro.config.js` for the new workspace root; run `expo start` and `expo start
--web` end to end before moving on — this is the step most likely to surface a real bug.
4. Split `ci.yml` → `backend-ci.yml` + `backend-deploy.yml` (add `paths:` filters,
   preserving all existing steps and secrets), add `frontend-ci.yml` (lint, format, tsc —
   doesn't exist as a standalone workflow today), rewrite `contract-check.yml` to drop the
   cross-repo checkout.
5. Fix the backend `Dockerfile`'s build context for the new path; do a full local
   `docker build` before merging.
6. Merge, watch the first real deploy (`backend-deploy.yml` firing only on a backend-path
   change), then archive the two old repos (don't delete — keep them read-only for history
   access) once the new one has run cleanly for a few PRs.

## Verification

- `git log --follow -- apps/backend/src/tasks/tasks.service.ts` and the frontend equivalent
  both show pre-migration history.
- `npm run api:types --workspace=apps/frontend` reads `apps/backend/openapi.json` with no
  env var needed, and `git diff --exit-code` on the generated file is clean right after
  generation from an unchanged schema.
- `expo start` and `expo start --web` both boot and hot-reload correctly (Metro resolution
  check).
- A backend-only commit does not trigger `frontend-ci.yml`; a frontend-only commit does not
  trigger `backend-deploy.yml`. Verify by pushing one trivial change on each side and reading
  the Actions run list, not just assuming the `paths:` filter is correct.
- `docker build` from CI succeeds and the smoke test in `backend-deploy.yml`
  (`/health/live`, `/health/ready`) still passes against the redeployed service.
