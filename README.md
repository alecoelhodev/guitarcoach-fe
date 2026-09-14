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

## Running against the deployed backend

`EXPO_PUBLIC_API_BASE_URL` defaults to `http://localhost:3000` (the local Docker backend) and
is what the **browser** uses. It does not work on a **physical phone in Expo Go**: the value is
resolved on your Mac at dev-server start and shipped to the device in the manifest, so the
phone receives the literal string `localhost` and resolves it to itself.

`EXPO_PUBLIC_API_BASE_URL_NATIVE` overrides it on **iOS/Android only**, so the phone can hit
the deployed Cloud Run service while the browser keeps hitting local Docker, from one dev
server:

```bash
echo 'EXPO_PUBLIC_API_BASE_URL_NATIVE=https://guitarcoach-685026468764.us-east1.run.app' > .env.local
npx expo start --clear    # the config is read at dev-server start, so a restart is required
```

`.env.local` overrides `.env`, is gitignored, and can be deleted to put native back on
localhost. Only `.env`, `.env.local`, `.env.[mode]` and `.env.[mode].local` are loaded — a file
named anything else is ignored, silently.

Four things to expect, none of them bugs in this app:

- **The two platforms are signed in to different databases.** With the split running, the phone
  authenticates against the deployed backend and the browser against your local one, so you
  need an account on each. There is no separate staging service; the deployed one is
  pre-production and not serving real traffic (see the backend's `docs/deployment.md`).
- **Don't point the browser at the deployed backend.** Its `CORS_ORIGINS` trusts only its own
  origin, so a browser's real `Origin` (`http://localhost:8081`) is rejected at preflight, and
  better-auth's `SameSite=Lax` cookie would not be stored cross-site anyway. Native is fine —
  `src/api/client.ts` synthesizes a matching `Origin` on iOS/Android. That is the whole reason
  the override is native-only.
- **The first launch after a cold start may bounce you to sign-in.** `getSession()` is capped
  at 5s (`src/api/auth.ts`) because the splash waits on it, and a Cloud Run cold start can take
  ~14s. Reopen the app and the session holds. The fix is backend side
  (`gcloud run services update guitarcoach --min-instances=1`), not a longer timeout.
- **EAS builds do not read `.env.local`.** Local env files are never uploaded to EAS Build, so a
  native binary built without `EXPO_PUBLIC_API_BASE_URL_NATIVE` set as an EAS environment
  variable falls back to `apiBaseUrl` — i.e. `localhost` — and fails on device with no error
  beyond "No connection". Set it with `eas env:create` for the profile you build.

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
