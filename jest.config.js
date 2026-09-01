/** @type {import('jest').Config} */
module.exports = {
  // jest-expo's preset already maps the `@/*` tsconfig paths and react-native itself;
  // overriding moduleNameMapper here would drop those.
  preset: 'jest-expo',
  // CI checks the backend repo out into `backend/`; without this Jest's default
  // rootDir crawl collects its ~30 `*.spec.ts` files. Mirrors tsconfig's exclude.
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
