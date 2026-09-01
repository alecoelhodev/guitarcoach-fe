/** @type {import('jest').Config} */
module.exports = {
  // jest-expo's preset already maps the `@/*` tsconfig paths and react-native itself;
  // overriding moduleNameMapper here would drop those.
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
