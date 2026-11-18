module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  // The rules tests talk to the Firestore emulator, which can occasionally
  // take longer than Jest's 5-second default to start responding. On a
  // busy computer its first answer has taken over 20 seconds, which failed
  // a whole run before a deploy, so each test and setup step gets a minute.
  testTimeout: 60000,
};
