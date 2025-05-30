const { defaults } = require('jest-config');

module.exports = {
  ...defaults,
  rootDir: process.cwd(),
  modulePathIgnorePatterns: ['<rootDir>/.history'],
  moduleDirectories: [...defaults.moduleDirectories, 'dist/node_modules'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^scheduler$': '<rootDir>/node_modules/scheduler/unstable_mock.js'
  },
  fakeTimers: {
    enableGlobally: true,
    legacyFakeTimers: true
  },
  setupFilesAfterEnv: ['./scripts/jest/setupJest.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  }
  // testMatch: ['**/*.test.ts', '**/*.test.tsx', '**/*.test.jsx']
};