const expoPreset = require('jest-expo/jest-preset');

// `src/lib/date-grouping.ts` derives "this week" in local time, so its tests assert
// different values on a UTC-3 laptop and on CI's UTC runner. Pinned here rather than in the
// npm script because `TZ=UTC jest` does not work on Windows; module scope is early enough,
// as workers fork after this file loads and inherit the env.
process.env.TZ = 'UTC';

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
  // Without this Jest only measures the files a test happens to import, which reported 84%
  // while the real figure across `src/` was 25%. Listing the sources explicitly makes the
  // number mean "of the app" rather than "of what we already test".
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/types/**', // generated api.d.ts plus one-line re-exports of it
    '!src/**/__tests__/**',
    '!src/test/**', // the shared helpers below are test code, not subject
    '!src/app/**', // expo-router route files: each re-exports one component from features/
  ],
  // A floor, not a target: set just under the measured figures (39.8/42.1/39.0/39.2 at the
  // time of writing, up from 27.2/28.4/21.6/27.0) so an untested addition trips the gate.
  // Raise it when suites land; never lower it to make a red build green.
  coverageThreshold: {
    global: { statements: 35, branches: 40, functions: 35, lines: 35 },
  },
};
