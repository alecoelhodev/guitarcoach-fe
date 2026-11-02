const reanimatedResolver = require('react-native-reanimated/jest/resolver');
const presetResolver = require(require('jest-expo/jest-preset').resolver);

// Reanimated ≥4.6 crashes under the iOS preset unless its own resolver steers a set of its
// modules to their web variants (software-mansion/react-native-reanimated#11034). jest-expo
// already sets React Native's resolver, and Jest takes only one, so this chains them: the
// reanimated resolver decides the extensions, then RN's does the actual lookup.
/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) =>
  reanimatedResolver(request, {
    ...options,
    defaultResolver: (path, opts) =>
      presetResolver(path, { ...opts, defaultResolver: options.defaultResolver }),
  });
