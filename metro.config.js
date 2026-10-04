// Created for NativeWind v4; the repo previously used @expo/metro-config's
// implicit defaults. `input` points at src/global.css, which already existed
// for its web font-stack vars and now also carries the @tailwind directives.
// `getSentryExpoConfig` is Expo's `getDefaultConfig` plus Sentry's debug-ID serializer,
// which ties uploaded source maps to the bundle; NativeWind must stay the outer wrapper.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
