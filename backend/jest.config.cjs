// Load test environment variables before any worker process starts.
// This ensures DATABASE_URL points to seomation_test (required by Prisma guard)
// and AI_MOCK=true so tests never call real AI APIs.
require('dotenv').config({ path: '.env.test', override: true });

module.exports = {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/**/*.config.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  maxWorkers: 1,
  testTimeout: 30000
};