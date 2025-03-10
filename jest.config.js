module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  transformIgnorePatterns: ['/node_modules/'],
  globals: {
    'ts-jest': {
      'useESM': true
    }
  },
  extensionsToTreatAsEsm: ['.ts'], // if you are using TypeScript
};