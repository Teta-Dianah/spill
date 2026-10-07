// Tests for firestore.rules — these run against the Firestore emulator,
// never against the real Spill database. Run them with:
//   firebase emulators:exec "npm test"
// so the emulator is up before Jest starts.

const fs = require('fs');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-spill-dev',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

describe('accounts', () => {
  test('a signed-in user can create their own account as role "user"', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'accounts/alice'), { pseudonym: 'CalmRiver12', role: 'user' })
    );
  });

  test('a user cannot create their own account with a different role', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'accounts/alice'), { pseudonym: 'CalmRiver12', role: 'admin' })
    );
  });

  test('signed-out visitors cannot create an account', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, 'accounts/alice'), { pseudonym: 'CalmRiver12', role: 'user' })
    );
  });

  test('a user can read their own account', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'accounts/alice'), {
        pseudonym: 'CalmRiver12',
        role: 'user',
      });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(db, 'accounts/alice')));
  });

  test('a user cannot read someone else\'s account', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'accounts/bob'), {
        pseudonym: 'BraveStone7',
        role: 'user',
      });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(db, 'accounts/bob')));
  });

  test('a user cannot change their own role through an update', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'accounts/alice'), {
        pseudonym: 'CalmRiver12',
        role: 'user',
      });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(db, 'accounts/alice'), { role: 'admin' }));
  });
});

describe('resources', () => {
  test('anyone signed out can read resources', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'resources/helpline-1'), {
        name: 'Example Helpline',
      });
    });

    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'resources/helpline-1')));
  });

  test('a regular user cannot add a resource', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'resources/helpline-2'), { name: 'Not allowed' })
    );
  });

  test('an admin account can add a resource', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'accounts/admin1'), {
        pseudonym: 'SteadyEmber3',
        role: 'admin',
      });
    });

    const db = testEnv.authenticatedContext('admin1').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'resources/helpline-2'), { name: 'Added by admin' })
    );
  });
});

describe('moods', () => {
  test('a user can create their own mood entry', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'moods/mood-1'), { uid: 'alice', score: 4 })
    );
  });

  test('a user cannot create a mood entry for someone else', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'moods/mood-2'), { uid: 'bob', score: 4 })
    );
  });

  test('a user cannot read someone else\'s mood entry', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'moods/mood-3'), {
        uid: 'bob',
        score: 2,
      });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(db, 'moods/mood-3')));
  });
});
