import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'guitar-coach-fe',
  slug: 'guitar-coach',
  version: '1.0.0',
  orientation: 'portrait',
  // Root view background behind all React views (expo-system-ui applies it natively)
  // and the default the web PWA manifest inherits. Without it both flash light.
  backgroundColor: '#0a0b0d',
  icon: './assets/images/icon.png',
  scheme: 'guitarcoachfe',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.coelhoadevsteam.guitarcoach',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
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
    package: 'com.coelhoadevsteam.guitarcoach',
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
    backgroundColor: '#0a0b0d',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-audio',
    'expo-asset',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0a0b0d',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    eas: {
      projectId: '54c693c8-66cc-46ee-b412-55cc201d6973',
    },
  },
  owner: 'coelhoadevs-team',
};

export default config;
