/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/core/**/*.ts', '!src/core/**/__tests__/**', '!src/core/__fixtures__/**', '!src/core/index.ts'],
  coverageThreshold: { 'src/core/': { lines: 90, branches: 85 } },
};
