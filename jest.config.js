module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  // The rules tests talk to the Firestore emulator, which can occasionally
  // take longer than Jest's 5-second default to start responding.
  testTimeout: 20000,
};
