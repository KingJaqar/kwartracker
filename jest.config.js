module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/components/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Lucide 1.61 per-icon native exports use .mjs; Jest 29 uses its equivalent CommonJS entries.
    '^lucide-react-native/icons/(.*)$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
  },
  testTimeout: 10000,
  cacheDirectory: '<rootDir>/.cache/jest',
};
