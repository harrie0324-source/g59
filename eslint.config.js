// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'coverage/*', 'drizzle/*'] },
  // React Native renders text literally, so apostrophes in JSX copy are fine.
  { rules: { 'react/no-unescaped-entities': 'off' } },
  {
    // The algorithm stays pure TypeScript: no React Native, Expo or app imports.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'react-native', 'expo*', '@/*', '@expo/*'] }],
    },
  },
]);
