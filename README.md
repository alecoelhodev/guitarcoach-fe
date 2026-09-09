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

`EXPO_PUBLIC_API_BASE_URL` defaults to `http://localhost:3000` (the local Docker backend).
That does not work on a **physical phone in Expo Go**, where `localhost` resolves to the phone
itself rather than your machine. Point it at the deployed Cloud Run service instead, in
`.env.local` — which overrides `.env`, is gitignored, and can be deleted to switch back:

```bash
echo 'EXPO_PUBLIC_API_BASE_URL=https://guitarcoach-685026468764.us-east1.run.app' > .env.local
npx expo start --clear    # the var is read at dev-server start, so restart is required
```

Three things to expect, none of them bugs in this app:

- **Web stops working against it.** The deployed backend's `CORS_ORIGINS` trusts only its own
  origin, so a browser's real `Origin` (`http://localhost:8081`) is rejected at preflight, and
  better-auth's `SameSite=Lax` cookie would not be stored cross-site anyway. Native is fine —
  `src/api/client.ts` synthesizes a matching `Origin` on iOS/Android. Keep `.env` on localhost
  for web work, or have the backend add `http://localhost:8081` to `CORS_ORIGINS`.
- **The first launch after a cold start may bounce you to sign-in.** `getSession()` is capped
  at 5s (`src/api/auth.ts`) because the splash waits on it, and a Cloud Run cold start can take
  ~14s. Reopen the app and the session holds. The fix is backend side
  (`gcloud run services update guitarcoach --min-instances=1`), not a longer timeout.
- **It is a different database from your local one**, so you need an account created there.
  There is no separate staging service; this one is pre-production and not serving real
  traffic (see the backend's `docs/deployment.md`).

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
