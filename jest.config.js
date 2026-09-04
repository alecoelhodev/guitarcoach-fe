const expoPreset = require('jest-expo/jest-preset');

// @gluestack-ui (and @legendapp, which it pulls in) publish untranspiled ESM —
// `export * from '../lib/esm/...'` — and lucide-react-native ships `.mjs`, so all
// three must be transformed rather than ignored. Derived from jest-expo's own
// pattern so it keeps tracking upstream rather than pinning a copy of it.
const transformIgnorePatterns = expoPreset.transformIgnorePatterns.map((pattern) =>
  pattern.startsWith('/node_modules/(?!')
    ? pattern.replace('(?!(', '(?!(@gluestack-ui|@legendapp|lucide-react-native|')
    : pattern,
);

// jest-expo only transforms `\.[jt]sx?$`, so `.mjs` dependencies (lucide-react-native)
// are never transformed no matter what transformIgnorePatterns says. Reuse the preset's
// own babel-jest entry — including its babel.config.js wiring — for `.mjs` too.
const jsTransform = expoPreset.transform['\\.[jt]sx?$'];

/** @type {import('jest').Config} */
module.exports = {
  // jest-expo's preset already maps the `@/*` tsconfig paths and react-native itself;
  // overriding moduleNameMapper here would drop those.
  preset: 'jest-expo',
  // CI checks the backend repo out into `backend/`; without this Jest's default
  // rootDir crawl collects its ~30 `*.spec.ts` files. Mirrors tsconfig's exclude.
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns,
  transform: { ...expoPreset.transform, '\\.mjs$': jsTransform },
};
