module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '\\.module\\.ts$',
    'main\\.ts$',
    'transaction\\.types\\.ts$',
    'domain-event-publisher\\.ts$',
    '/domain/events/',
    'account\\.repository\\.ts$',
    'client\\.repository\\.ts$',
    'topics\\.ts$'
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node'
};
