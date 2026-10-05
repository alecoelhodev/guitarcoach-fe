import type { ExpoConfig } from 'expo/config';

// The plugin itself tolerates missing slugs, but it adds a source-map upload step to the native
// build that fails without SENTRY_AUTH_TOKEN. Until the project exists, leave it out entirely;
// the JS SDK still links and runs (it is inert without a DSN). Once the slugs are set, the token
// must be an EAS secret too, or set SENTRY_DISABLE_AUTO_UPLOAD=true.
const sentryOrg = process.env.SENTRY_ORG || undefined;
const sentryProject = process.env.SENTRY_PROJECT || undefined;
const sentryPlugin: NonNullable<ExpoConfig['plugins']> =
  sentryOrg && sentryProject
    ? [['@sentry/react-native/expo', { organization: sentryOrg, project: sentryProject }]]
    : [];

const config: ExpoConfig = {
  name: 'Progress Pick',
  slug: 'guitar-coach',
  version: '1.0.0',
  orientation: 'portrait',
  // Root view background behind all React views (expo-system-ui applies it natively)
  // and the default the web PWA manifest inherits. Without it both flash light.
  backgroundColor: '#0a0b0d',
  icon: './assets/images/icon.png',
  scheme: 'guitarcoachfe',
  // The UI is dark-only. Android applies this through expo-system-ui.
  userInterfaceStyle: 'dark',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.coelhoadevsteam.progresspick',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    // Apple does not reliably read the PrivacyInfo.xcprivacy that static CocoaPods ship, so the
    // Expo docs say to copy them here. This is the union of those in node_modules (react-native,
    // async-storage, expo-constants, expo-file-system, expo-system-ui); re-check after upgrades.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
      ],
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0a0b0d',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    package: 'com.coelhoadevsteam.progresspick',
  },
  web: {
    output: 'static',
    name: 'Progress Pick',
    shortName: 'Progress Pick',
    themeColor: '#0a0b0d',
    favicon: './assets/images/favicon.png',
    backgroundColor: '#0a0b0d',
  },
  plugins: [
    'expo-router',
    [
      'expo-audio',
      {
        // Playback only (recording-row); uploads go through DocumentPicker. The defaults add a
        // mic prompt, RECORD_AUDIO and background-audio modes the app never uses.
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundPlayback: false,
      },
    ],
    'expo-asset',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0a0b0d',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    ...sentryPlugin,
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    // Diagnostic only — these exist so `npx expo config --type public --json` can report which
    // backend a command will use without starting a server. Do NOT read them at runtime: on web
    // `Constants.expoConfig` is a Babel-inlined copy of APP_MANIFEST, and Metro caches that
    // transform without keying on the config, so it goes stale across restarts. `src/api/client.ts`
    // reads `process.env.EXPO_PUBLIC_*` instead, which the serializer re-injects every build.
    //
    // `|| undefined`, not a bare read: @expo/env skips any key already present in `process.env`
    // using `typeof !== 'undefined'`, so `EXPO_PUBLIC_API_BASE_URL_NATIVE= expo start` — how the
    // dev scripts neutralise a stale .env entry — arrives here as `''`, which would print as an
    // empty string rather than "unset".
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || undefined,
    // iOS/Android only, where `localhost` resolves to the phone rather than the dev
    // machine. Unset is the normal case — both platforms then share `apiBaseUrl`.
    apiBaseUrlNative: process.env.EXPO_PUBLIC_API_BASE_URL_NATIVE || undefined,
    eas: {
      projectId: '54c693c8-66cc-46ee-b412-55cc201d6973',
    },
  },
  owner: 'coelhoadevs-team',
};

export default config;
