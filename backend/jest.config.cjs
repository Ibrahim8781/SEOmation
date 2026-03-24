module.exports = {
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/**/*.config.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  maxWorkers: 1,
  testTimeout: 30000,
  projects: [
    {
      // Pure unit tests – no database required
      displayName: 'unit',
      testEnvironment: 'node',
      transform: {},
      testMatch: [
        '**/tests/unit.*.test.js',
        '**/tests/seo.unit.test.js',
        '**/tests/smart-scheduler.unit.test.js',
        '**/tests/integration.unit.test.js'
      ]
    },
    {
      // Integration + security tests – require a real test database
      displayName: 'integration',
      testEnvironment: 'node',
      transform: {},
      testMatch: [
        '**/tests/*.integration.test.js',
        '**/tests/security.test.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
    }
  ]
};