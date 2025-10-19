module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  // Limit coverage to changed files to avoid parsing unrelated sources
  collectCoverageFrom: [
    'config.js',
    'waifu.js',
    'commands/join.js',
    'voice-handler-gemini-rotation.js'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};