const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const designTokens = require('./scripts/eslint/design-tokens');
module.exports = defineConfig([
  expoConfig,
  { ignores: ['.cache/**', 'dist/**', 'coverage/**', 'documentation/**', 'documentation_guides/**'] },
  {
    files: ['src/**/*.{ts,tsx}'], ignores: ['src/theme/tokens.ts'],
    plugins: { kwartracker: { rules: { 'design-tokens': designTokens } } },
    rules: { 'kwartracker/design-tokens': 'error', '@typescript-eslint/no-explicit-any': 'error' },
  },
]);
