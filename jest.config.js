/** @type {import('jest').Config} */
module.exports = {
  // Logic tests (core algorithm, database, services) run in plain Node.
  preset: 'jest-expo/node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: [
    'src/core/**/*.ts',
    'src/db/**/*.ts',
    'src/lib/**/*.ts',
    'src/services/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/__fixtures__/**',
    '!src/core/index.ts',
    '!src/db/client*.ts', // app-only (expo-sqlite)
  ],
  coverageThreshold: { 'src/core/': { lines: 90, branches: 85 } },
};
