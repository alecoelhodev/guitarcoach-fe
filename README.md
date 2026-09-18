# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Working with the API

Types in `src/types/` are generated from the backend's OpenAPI schema, not hand-written.
After any backend API change, see
[docs/api-contract-workflow.md](docs/api-contract-workflow.md) for the commands to run and
the order to merge in.

## Choosing which backend the app talks to

One command per backend. Nothing to edit, and no `.env` file can override them — a variable
already set in the shell wins, because Expo's loader never overwrites a key that is already
defined in `process.env`.

| Command                 | Browser      | Phone (Expo Go)                           |
| ----------------------- | ------------ | ----------------------------------------- |
| `npm run dev:local`     | local Docker | local Docker, over your Mac's LAN address |
| `npm run dev:cloud`     | local Docker | the deployed Cloud Run service            |
| `npm run dev:cloud-web` | Cloud Run    | Cloud Run                                 |

A bare `npm start` — or `npx expo start` — uses `.env`, which is `http://localhost:3000`. Adding a
`.env.local` silently outranks it; see
[Which `.env` files are actually loaded](#which-env-files-are-actually-loaded).

> **These are npm scripts, not Expo subcommands.** `npx expo dev:local` does not run one. Expo's
> CLI defaults to `start` and treats any word it does not recognise as a **project path**, so you
> get `Invalid project root: …/dev:local` — an error that names a directory rather than the
> mistake. Always `npm run`.

**The app tells you which one it picked**, so "No connection" is never ambiguous:

- the dev server prints `[api] localhost:3000 — via EXPO_PUBLIC_API_BASE_URL` at startup;
- Profile shows an **API** row with the same host (dev builds only);
- an offline error names the host it could not reach, e.g. "Couldn't reach localhost:3000."

Switching backends needs a **dev-server restart** — run a different script — but not `--clear`.
`src/api/client.ts` reads `process.env.EXPO_PUBLIC_API_BASE_URL`, and Metro's serializer re-injects
every `EXPO_PUBLIC_*` variable on each build, so no cache sits between the script you ran and the
app. If the API row ever disagrees with the script, that is a bug, not something to paper over with
a cache clear.

> **Why the app does not read `Constants.expoConfig.extra`.** It did once, and on web it went stale:
> `babel-preset-expo` inlines the whole app config into `expo-constants` as a literal at transform
> time, and Metro's cache key does not include the config — so a browser kept serving a base URL
> from an earlier session across every restart, while the phone (which gets the manifest fresh per
> request) was correct. `app.config.ts` still copies both variables into `extra`, but only so
> `expo config` can report them; nothing at runtime reads it.

### Why `localhost` works on a phone now

It did not used to. Both variables are resolved on your Mac and inlined into the bundle the device
downloads, so a phone receiving `localhost` resolves it to _itself_. `src/api/base-url.ts` rewrites
a loopback host to the dev machine's LAN address from `Constants.expoConfig.hostUri`, keeping the
API port — so `dev:local` reaches your Docker backend from the phone.

Two limits, both deliberate: the rewrite only happens when `hostUri` is a bare IPv4 address, so
`expo start --tunnel` (whose `hostUri` is a public `*.exp.direct` bundler host with no API on it)
is left alone; and `hostUri` exists only under `expo start`, so a production build never rewrites
anything.

### Four things to expect, none of them bugs in this app

- **The two platforms can be signed in to different databases.** Under `dev:cloud` the phone
  authenticates against the deployed backend and the browser against your local one, so you need
  an account on each. There is no separate staging service; the deployed one is pre-production
  and not serving real traffic (see the backend's `docs/deployment.md`).
- **`dev:cloud-web` will probably not let you sign in.** The backend's `CORS_ORIGINS` trusts
  only its own origin, so a browser's real `Origin` (`http://localhost:8081`) is rejected at
  preflight, and better-auth's `SameSite=Lax` cookie would not be stored cross-site anyway. Native
  is fine — `src/api/client.ts` synthesizes a matching `Origin` on iOS/Android. That is the whole
  reason the native-only override exists.
- **The first launch after a Cloud Run cold start may bounce you to sign-in.** `getSession()` is
  capped at 5s (`src/api/auth.ts`) because the splash waits on it, and a cold start can take ~14s.
  Reopen the app and the session holds. The fix is backend side
  (`gcloud run services update guitarcoach --min-instances=1`), not a longer timeout.
- **EAS builds read none of this.** Local env files are never uploaded to EAS Build and `eas.json`
  declares no `env` block, so a binary built today falls back to nothing and throws at
  `src/api/client.ts` on launch. Set the variables with `eas env:create` for the profile you build.

### Which `.env` files are actually loaded

Four filenames, and **the first one to define a key wins**:

1. `.env.[mode].local`
2. `.env.local`
3. `.env.[mode]`
4. `.env`

`[mode]` is `development` under `expo start` and always `production` under `expo export`. Anything
else — `.env.staging`, `.env.cloudrun.local`, `.env.dev` — is ignored **silently**, with no warning
that the file you just edited is doing nothing.

Two traps follow from the ordering, and both have already cost time here:

- **`.env.local` outranks `.env`.** Editing `.env` while a `.env.local` defines the same key
  changes nothing, and neither file says so. If you keep a `.env.local`, treat it as the only one
  that exists.
- **A shell variable outranks all four.** Expo's loader skips any key already defined in
  `process.env` (`node_modules/@expo/env/build/index.js`), which is exactly why the scripts above
  work and why no `.env` file can undermine them. Expo's published docs do not state this; the
  loader source does.

### Checking which backend a command will use, without starting it

`expo config` evaluates the whole chain — shell variables, `.env` files, `app.config.ts` — and
prints the result:

```bash
npx expo config --type public --json | python3 -c \
  'import json,sys; e=json.load(sys.stdin)["extra"]; print("web:", e["apiBaseUrl"]); print("native:", e.get("apiBaseUrlNative") or "(unset)")'
```

Prefix it exactly as a script does to check that script — e.g.
`EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 npx expo config …`.

### When you get "No connection"

It is one `ApiError` with `status: 0` covering four different causes, so work down the list:

1. **Check which backend you are on** — the `[api] …` line in the dev-server output, or the API row
   on Profile. A wrong host here explains everything below it.
2. **Browser pointed at Cloud Run?** That cannot work. `CORS_ORIGINS` on the deployed service
   trusts only its own origin, so the preflight is rejected before any request is made. Use
   `npm run dev:local` or `npm run dev:cloud`.
3. **Phone showing `localhost`?** The LAN rewrite did not fire — you are on `--tunnel`, or
   `hostUri` was unavailable. `npm run dev:cloud` sidesteps it.
4. **Local backend actually up?** `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/health/ready`
   should print `200`. `/health/live` and `/health/ready` are the only routes that need no auth.

### "Invalid project root" or "Unsupported URL Type"

Both mean the same thing: the script was run with `npx` instead of `npm run`. Neither error says so,
and they look unrelated, so here they are side by side.

| What you typed       | What you get                            | Why                                                                                                                                                                                                                       |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx expo dev:cloud` | `Invalid project root: …/dev:cloud`     | Expo's CLI has no `dev` command. It falls back to its default (`start`) and passes the unrecognised word through as a **directory**. Any typo does this — `npx expo statr` reports a bad project root, not a bad command. |
| `npx dev:cloud`      | `npm error Unsupported URL Type "dev:"` | npx reads `dev:cloud` as a **package to install** and treats `dev:` as a URL protocol, like `github:` or `file:`. It never looks at this project's scripts.                                                               |
| `npm dev:cloud`      | `Unknown command`                       | npm does not run scripts without `run`. This is the only one of the three that names the actual problem.                                                                                                                  |

```bash
npm run dev:cloud   # ✓ the only correct form
```

`npx` is for running **packages** (`npx expo`, `npx tsc`). `npm run` is for running **this project's
scripts**. The backend switches are scripts.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- Lint with `npx expo lint` (ESLint). Format with `npm run format` (Biome for code, Prettier for Markdown) — see `AGENTS.md`.
- Run tests with `npm test` (Jest + jest-expo). `npm run test:coverage` adds the coverage floor CI enforces.
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
