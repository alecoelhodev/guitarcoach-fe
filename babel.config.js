// Created for NativeWind v4. Expo SDK 57 otherwise runs on implicit
// babel-preset-expo defaults, so this file exists only to add the two things
// NativeWind needs: the `nativewind` JSX runtime and its own preset.
//
// `experiments.reactCompiler` in app.config.ts is handled inside
// babel-preset-expo, so it stays listed first.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
