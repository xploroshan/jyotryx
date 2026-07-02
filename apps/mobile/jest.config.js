/**
 * Unit / component test config (Jest + jest-expo). Detox has its own config at
 * e2e/jest.config.js. The workspace source package @myastro360/shared ships as
 * TypeScript, so it's whitelisted out of transformIgnorePatterns.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-css-interop|@myastro360/shared))',
  ],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
};
