// Created for NativeWind v4; the repo previously used @expo/metro-config's
// implicit defaults. `input` points at src/global.css, which already existed
// for its web font-stack vars and now also carries the @tailwind directives.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
