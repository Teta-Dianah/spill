// Creates one demo account per role in the local emulators, so every
// part of Spill can be tried straight after cloning: a user, a listener
// (approved, trained and available), a moderator and an admin. Also
// adds one pending term suggestion from the moderator.
//
// EMULATORS ONLY. These accounts have passwords that are written in the
// README, so they must never exist in a real Firebase project. The
// script always uses the emulator-only project "demo-spill-dev" and
// stops if it is pointed anywhere other than this computer.
//
// Run with: npm run seed:accounts
// Needs the emulators running first: npm run emulators
// Safe to run again: existing demo accounts are reset, not duplicated.

const PROJECT_ID = 'demo-spill-dev';
const DEMO_PASSWORD = 'spill-demo-123';

const DEMO_ACCOUNTS = [
  { uid: 'demo-user', email: 'user@spill.test', pseudonym: 'CalmRiver11', role: 'user' },
  { uid: 'demo-listener', email: 'listener@spill.test', pseudonym: 'KindMaple22', role: 'user', isListener: true },
  { uid: 'demo-moderator', email: 'moderator@spill.test', pseudonym: 'SteadyStone33', role: 'moderator' },
  { uid: 'demo-admin', email: 'admin@spill.test', pseudonym: 'BrightSky44', role: 'admin' },
];

// True only for an emulator address on this computer, like "localhost:8080".
function isLocalEmulator(host) {
  return /^(localhost|127\.0\.0\.1):\d+$/.test(host || '');
}

// Returns a reason to stop, or '' if it is safe to go on.
function reasonToRefuse(env) {
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    return 'GOOGLE_APPLICATION_CREDENTIALS is set, which points at a real project.';
  }
  if (!isLocalEmulator(env.FIRESTORE_EMULATOR_HOST)) {
    return 'FIRESTORE_EMULATOR_HOST must be a local emulator address.';
  }
  if (!isLocalEmulator(env.FIREBASE_AUTH_EMULATOR_HOST)) {
    return 'FIREBASE_AUTH_EMULATOR_HOST must be a local emulator address.';
  }
  return '';
}

async function createDemoAccount(auth, db, account) {
  // Start clean so running the script twice gives the same result.
  await auth.deleteUser(account.uid).catch(function () {});
  await auth.createUser({ uid: account.uid, email: account.email, password: DEMO_PASSWORD });

  await db.collection('accounts').doc(account.uid).set({
    pseudonym: account.pseudonym,
    ageBand: '18-25',
    firstTimeSeekingHelp: false,
    role: account.role,
    status: 'active',
    blockedUids: [],
    createdAt: new Date(),
  });

  if (account.isListener) {
    await db.collection('listeners').doc(account.uid).set({
      status: 'approved',
      clearedForMinors: true,
      available: true,
      trainingComplete: true,
      motivation: 'Demo listener account.',
      createdAt: new Date(),
    });
  }
}

// One pending suggestion from the demo moderator, so the admin page has
// something to approve or reject straight away (FR 7.1).
async function createDemoSuggestion(db) {
  await db.collection('termSuggestions').doc('demo-suggestion').set({
    phrase: 'nobody would miss me',
    category: 'crisis',
    note: 'Came up in a flagged chat and is not on the list yet.',
    suggestedBy: 'demo-moderator',
    status: 'pending',
    createdAt: new Date(),
  });
}

async function seed() {
  // The emulator addresses are set here, before Firebase loads, unless
  // they were already given. Either way they are checked below.
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

  const reason = reasonToRefuse(process.env);
  if (reason) {
    console.error('Refusing to create demo accounts: ' + reason);
    console.error('This script is for the local emulators only.');
    process.exit(1);
  }

  const { initializeApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getAuth } = require('firebase-admin/auth');

  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore();

  for (const account of DEMO_ACCOUNTS) {
    await createDemoAccount(auth, db, account);
    console.log('  ' + (account.isListener ? 'listener' : account.role).padEnd(10) + account.email);
  }
  await createDemoSuggestion(db);
  console.log('  one pending term suggestion from the moderator');
  console.log('Demo accounts ready. The password is in the README.');
  process.exit(0);
}

if (require.main === module) {
  seed().catch(function (error) {
    console.error('Could not create the demo accounts. Are the emulators running?');
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { isLocalEmulator, reasonToRefuse };
