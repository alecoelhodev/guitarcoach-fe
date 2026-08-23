# API contract sync — implementation

Backend already has Swagger wired (`@nestjs/swagger` CLI plugin in `nest-cli.json`, live docs
at `/docs` via `main.ts`). What's missing is a file artifact and the check that keeps it
honest across two repos. Below is the exact code for both.

---

## Backend (`guitar-coach`)

### 1. Extract the Swagger config so the server and the generator can't drift

`main.ts` currently builds `DocumentBuilder` inline. Pull it into a shared file both use.

**New file: `src/swagger.config.ts`**

```ts
import { DocumentBuilder } from '@nestjs/swagger';

export function buildSwaggerConfig(apiVersion: string) {
  return new DocumentBuilder()
    .setTitle('Guitar Coach API')
    .setDescription('API documentation for the Guitar Coach backend')
    .setVersion(apiVersion)
    .build();
}
```

**`src/main.ts` — replace the inline block:**

```diff
-  const swaggerConfig = new DocumentBuilder()
-    .setTitle('Guitar Coach API')
-    .setDescription('API documentation for the Guitar Coach backend')
-    .setVersion(apiVersion)
-    .build();
+  const swaggerConfig = buildSwaggerConfig(apiVersion);
   const swaggerDocument = () =>
     SwaggerModule.createDocument(app, swaggerConfig);
   SwaggerModule.setup('docs', app, swaggerDocument);
```

Add `import { buildSwaggerConfig } from './swagger.config';` and drop the now-unused
`DocumentBuilder` import.

### 2. The generator script

Boots the same `AppModule`, builds the document, writes it, exits. Deliberately never calls
`app.listen()` or `connectMicroservice()` — it only needs Nest's reflection metadata, not a
running server, so it works without RabbitMQ and without a reachable Postgres/Redis.

**New file: `scripts/generate-openapi.ts`**

```ts
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { buildSwaggerConfig } from '../src/swagger.config';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig('v1'));
  writeFileSync('openapi.json', JSON.stringify(document, null, 2));
  await app.close();
  console.log('Wrote openapi.json');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

*Verify:* `PrismaService` and `createAuth()` are expected to hold connection config without
connecting eagerly, and `KeyvRedis` is already configured with `disableOfflineQueue` +
`throwOnConnectError: false` — so module construction shouldn't require live infra. Run it
locally once against your normal `.env` to confirm before wiring it into CI.

### 3. Scripts

```jsonc
// package.json — add to "scripts"
"openapi:generate": "tsx scripts/generate-openapi.ts",
"openapi:check": "npm run openapi:generate && git diff --exit-code openapi.json"
```

Matches the existing `db:seed`/`weekly-routine-cleanup` convention of running `.ts` scripts
directly with `tsx` — no separate build step.

Commit `openapi.json` at the repo root once generated. It's the artifact the frontend reads;
having it in git means a contract change shows up as a diff in code review.

### 4. CI — add a step to the existing workflow

`openapi:generate` needs the env schema to validate, but never touches real infrastructure —
so CI can run it against fake-but-valid values instead of real secrets.

**`.github/workflows/ci.yml` — add after the `build` step:**

```yaml
      - name: Generate OpenAPI schema and check it's committed
        run: npm run openapi:check
        env:
          NODE_ENV: test
          PORT: '3000'
          API_PREFIX: api
          API_VERSION: v1
          DATABASE_URL: postgres://user:pass@localhost:5432/db
          BETTER_AUTH_SECRET: ci-placeholder-secret-at-least-32-chars-long
          BETTER_AUTH_URL: http://localhost:3000
          REDIS_URL: redis://localhost:6379
          RABBITMQ_URL: amqp://localhost:5672
          GCP_PROJECT_ID: ci-placeholder
          GCS_RECORDINGS_BUCKET: ci-placeholder
          OPENAI_API_KEY: ci-placeholder
          OPENAI_MODEL: gpt-4o-mini
          LOG_LEVEL: error
          METRICS_EXPORT_ENABLED: 'false'
```

If a PR changes a DTO without regenerating `openapi.json`, this step fails on the `git diff`
and the PR shows exactly what's stale.

---

## Frontend (`guitar-coach-fe`)

### 1. Dependencies

```bash
npm i -D openapi-typescript
```

### 2. Scripts

```jsonc
// package.json — add to "scripts"
"api:types": "openapi-typescript ${BACKEND_OPENAPI_PATH:-../guitar-coach/openapi.json} -o src/types/api.d.ts",
"api:types:remote": "openapi-typescript $EXPO_PUBLIC_API_BASE_URL/docs-json -o src/types/api.d.ts",
"api:types:check": "npm run api:types && git diff --exit-code src/types/api.d.ts && tsc --noEmit"
```

- `api:types` reads the sibling repo by default (`../guitar-coach/openapi.json`); override
  with `BACKEND_OPENAPI_PATH` when the layout differs (e.g. in CI, §4 below).
- `api:types:remote` hits the live server directly — `SwaggerModule.setup('docs', ...)`
  exposes the raw document at `/docs-json` alongside the Swagger UI at `/docs`, no extra
  backend work needed.
- Both scripts use `${VAR:-default}` shell expansion — bash/zsh only. Fine for macOS/Linux
  dev machines and GitHub Actions' default `ubuntu-latest` shell; on Windows run through
  WSL or git-bash, or swap in `cross-env`-style handling if the team develops on native
  Windows.

### 3. Re-point the hand-written types

One resource at a time, once `api.d.ts` exists. Example for tasks:

```ts
// src/types/task.ts — before
export type Task = {
  id: string;
  title: string;
  category?: TaskCategory;
  difficulty?: TaskDifficulty;
  referenceLink?: string;
  description?: string;
};

// after
import type { components } from '@/types/api';
export type Task = components['schemas']['TaskResponseDto'];
export type TaskCategory = Task['category'];
export type TaskDifficulty = Task['difficulty'];
```

The exact schema name depends on what the backend's CLI-plugin-generated DTO classes are
called — run `api:types` once and read `src/types/api.d.ts`'s `components['schemas']` keys
before wiring each file; don't guess the name.

Do this per resource (`task`, `routine`, `session`, `recording`, `coach`, `user`) rather than
in one pass, so each file's tests catch a mismatch immediately.

### 4. CI — cross-repo check

The frontend's CI needs the backend's `openapi.json`. Checking out the backend repo alongside
is simpler than publishing the schema anywhere else.

**New file: `.github/workflows/contract.yml`**

```yaml
name: API contract

on:
  pull_request:
    branches: [main]

jobs:
  check-types:
    runs-on: ubuntu-latest
    steps:
      - name: Check out frontend
        uses: actions/checkout@v6

      - name: Check out backend
        uses: actions/checkout@v6
        with:
          repository: <org>/guitar-coach
          path: backend
          # Only needed if the backend repo is private and not already accessible
          # to this workflow's default token.
          token: ${{ secrets.BACKEND_REPO_TOKEN }}

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Regenerate types from backend/openapi.json and verify no drift
        run: npm run api:types:check
        env:
          BACKEND_OPENAPI_PATH: backend/openapi.json
```

Replace `<org>/guitar-coach` with the real slug. If both repos live under the same GitHub
org and the workflow's default `GITHUB_TOKEN` can already read the backend repo (both
public, or an org-level policy that allows it), the `token:` line can be dropped; otherwise
add `BACKEND_REPO_TOKEN` as a repo secret — a PAT or a fine-grained token scoped to read-only
on `guitar-coach`.

This job fails in exactly the two cases that matter: the backend changed a schema and the
frontend types weren't regenerated, or the regenerated types no longer type-check against
the app.

---

## Order of work

1. Backend: add `swagger.config.ts`, `generate-openapi.ts`, the two scripts, run
   `npm run openapi:generate` once locally, commit `openapi.json`.
2. Backend: add the CI step, confirm it passes on a clean PR.
3. Frontend: install `openapi-typescript`, add the three scripts, run `npm run api:types`
   once locally against the sibling checkout, commit `src/types/api.d.ts`.
4. Frontend: re-point `src/types/*.ts` one resource at a time, fixing whatever `tsc` flags
   in each feature folder as you go.
5. Frontend: add `contract.yml`, fill in the real backend repo slug and token if needed.

Steps 1–3 are mechanical. Step 4 is where the payoff shows up — every DTO field that the
hand-written types got wrong or missed becomes a compile error, not a runtime surprise.
