module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleDirectories: ['node_modules', 'scripts'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  transform: {},
  moduleNameMapper: {
    '^angular$': '<rootDir>/node_modules/angular/angular.min.js'
  }
};