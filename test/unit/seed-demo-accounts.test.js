// The demo-accounts script must never run against a real project. These
// tests cover the check that decides whether it is allowed to run.
const { isLocalEmulator, reasonToRefuse } = require('../../scripts/seed-demo-accounts.js');

const LOCAL = {
  FIRESTORE_EMULATOR_HOST: 'localhost:8080',
  FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
};

describe('isLocalEmulator', () => {
  test('accepts an address on this computer', () => {
    expect(isLocalEmulator('localhost:8080')).toBe(true);
    expect(isLocalEmulator('127.0.0.1:9099')).toBe(true);
  });

  test('refuses anything else', () => {
    expect(isLocalEmulator('')).toBe(false);
    expect(isLocalEmulator(undefined)).toBe(false);
    expect(isLocalEmulator('firestore.googleapis.com')).toBe(false);
    expect(isLocalEmulator('firestore.googleapis.com:443')).toBe(false);
    expect(isLocalEmulator('localhost')).toBe(false);
    expect(isLocalEmulator('localhost:8080.example.com')).toBe(false);
    expect(isLocalEmulator('example.com/localhost:8080')).toBe(false);
  });
});

describe('reasonToRefuse', () => {
  test('allows both emulators on this computer', () => {
    expect(reasonToRefuse(LOCAL)).toBe('');
  });

  test('refuses when the Firestore emulator address is missing or remote', () => {
    expect(reasonToRefuse({ ...LOCAL, FIRESTORE_EMULATOR_HOST: undefined })).not.toBe('');
    expect(reasonToRefuse({ ...LOCAL, FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' })).not.toBe('');
  });

  test('refuses when the Auth emulator address is missing or remote', () => {
    expect(reasonToRefuse({ ...LOCAL, FIREBASE_AUTH_EMULATOR_HOST: undefined })).not.toBe('');
    expect(reasonToRefuse({ ...LOCAL, FIREBASE_AUTH_EMULATOR_HOST: 'identitytoolkit.googleapis.com' })).not.toBe('');
  });

  test('refuses when a service-account key is configured', () => {
    expect(reasonToRefuse({ ...LOCAL, GOOGLE_APPLICATION_CREDENTIALS: 'key.json' })).not.toBe('');
  });
});
