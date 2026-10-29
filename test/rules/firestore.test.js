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

  test('an admin can read someone else\'s account (to review a listener application)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'accounts/admin1'), {
        pseudonym: 'SteadyEmber3',
        role: 'admin',
      });
      await setDoc(doc(context.firestore(), 'accounts/bob'), {
        pseudonym: 'BraveStone7',
        role: 'user',
      });
    });

    const db = testEnv.authenticatedContext('admin1').firestore();
    await assertSucceeds(getDoc(doc(db, 'accounts/bob')));
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

describe('listeners', () => {
  test('a user can apply to be a listener for themselves', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'listeners/alice'), {
        status: 'pending',
        clearedForMinors: false,
        available: false,
        trainingComplete: false,
      })
    );
  });

  test('a user cannot apply already marked approved', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'listeners/alice'), {
        status: 'approved',
        clearedForMinors: false,
        available: false,
        trainingComplete: false,
      })
    );
  });

  test('a user cannot apply on someone else\'s behalf', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'listeners/bob'), {
        status: 'pending',
        clearedForMinors: false,
        available: false,
        trainingComplete: false,
      })
    );
  });

  test('any signed-in user can read the listeners list (needed for matching)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'listeners/grace'), {
        status: 'approved',
        clearedForMinors: true,
        available: true,
        trainingComplete: true,
      });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(db, 'listeners/grace')));
  });

  test('a listener can toggle their own availability', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'listeners/grace'), {
        status: 'approved',
        clearedForMinors: false,
        available: false,
        trainingComplete: true,
      });
    });

    const db = testEnv.authenticatedContext('grace').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'listeners/grace'), { available: true })
    );
  });

  test('a listener cannot approve themselves', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'listeners/grace'), {
        status: 'pending',
        clearedForMinors: false,
        available: false,
        trainingComplete: false,
      });
    });

    const db = testEnv.authenticatedContext('grace').firestore();
    await assertFails(
      updateDoc(doc(db, 'listeners/grace'), { status: 'approved' })
    );
  });

  test('an admin can approve a listener and clear them for minors', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'accounts/admin1'), {
        pseudonym: 'SteadyEmber3',
        role: 'admin',
      });
      await setDoc(doc(context.firestore(), 'listeners/grace'), {
        status: 'pending',
        clearedForMinors: false,
        available: false,
        trainingComplete: true,
      });
    });

    const db = testEnv.authenticatedContext('admin1').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'listeners/grace'), { status: 'approved', clearedForMinors: true })
    );
  });
});

describe('chats', () => {
  async function seedApprovedListener(uid, overrides = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `listeners/${uid}`), {
        status: 'approved',
        clearedForMinors: false,
        available: true,
        trainingComplete: true,
        ...overrides,
      });
    });
  }

  async function seedAccount(uid, ageBand) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `accounts/${uid}`), {
        pseudonym: 'Test',
        role: 'user',
        ageBand,
      });
    });
  }

  test('a user can request a chat with an approved, available listener', async () => {
    await seedAccount('alice', '18-25');
    await seedApprovedListener('grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'chats/chat-1'), { userId: 'alice', listenerId: 'grace', status: 'pending' })
    );
  });

  test('a new chat cannot be created already active (must start pending, FR 5.5)', async () => {
    await seedAccount('alice', '18-25');
    await seedApprovedListener('grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'chats/chat-1'), { userId: 'alice', listenerId: 'grace', status: 'active' })
    );
  });

  test('a user cannot request a chat with a listener who is not approved', async () => {
    await seedAccount('alice', '18-25');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'listeners/grace'), {
        status: 'pending',
        clearedForMinors: false,
        available: true,
        trainingComplete: true,
      });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'chats/chat-1'), { userId: 'alice', listenerId: 'grace', status: 'pending' })
    );
  });

  test('a user cannot request a chat with a listener who is unavailable', async () => {
    await seedAccount('alice', '18-25');
    await seedApprovedListener('grace', { available: false });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'chats/chat-1'), { userId: 'alice', listenerId: 'grace', status: 'pending' })
    );
  });

  test('a 16-17 user cannot match with a listener not cleared for minors (BR 1)', async () => {
    await seedAccount('young-alice', '16-17');
    await seedApprovedListener('grace', { clearedForMinors: false });

    const db = testEnv.authenticatedContext('young-alice').firestore();
    await assertFails(
      setDoc(doc(db, 'chats/chat-1'), { userId: 'young-alice', listenerId: 'grace', status: 'pending' })
    );
  });

  test('a 16-17 user can match with a listener cleared for minors (BR 1)', async () => {
    await seedAccount('young-alice', '16-17');
    await seedApprovedListener('grace', { clearedForMinors: true });

    const db = testEnv.authenticatedContext('young-alice').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'chats/chat-1'), { userId: 'young-alice', listenerId: 'grace', status: 'pending' })
    );
  });

  test('the matched listener can accept a pending chat (FR 5.5)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'chats/chat-1'), {
        userId: 'alice',
        listenerId: 'grace',
        status: 'pending',
        createdAt: { seconds: 1, nanoseconds: 0 },
      });
    });

    const db = testEnv.authenticatedContext('grace').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'chats/chat-1'), { status: 'active' })
    );
  });

  test('the matched listener can decline a pending chat (FR 5.5)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'chats/chat-1'), {
        userId: 'alice',
        listenerId: 'grace',
        status: 'pending',
        createdAt: { seconds: 1, nanoseconds: 0 },
      });
    });

    const db = testEnv.authenticatedContext('grace').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'chats/chat-1'), { status: 'declined' })
    );
  });

  test('someone outside the chat cannot read it', async () => {
    await seedAccount('alice', '18-25');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'chats/chat-1'), {
        userId: 'alice',
        listenerId: 'grace',
        status: 'active',
      });
    });

    const db = testEnv.authenticatedContext('mallory').firestore();
    await assertFails(getDoc(doc(db, 'chats/chat-1')));
  });

  test('a participant can update a chat but cannot reassign who it belongs to', async () => {
    const createdAt = { seconds: 1, nanoseconds: 0 };
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'chats/chat-1'), {
        userId: 'alice',
        listenerId: 'grace',
        status: 'active',
        createdAt,
      });
    });

    const db = testEnv.authenticatedContext('grace').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'chats/chat-1'), { status: 'ended' })
    );
    await assertFails(
      updateDoc(doc(db, 'chats/chat-1'), { listenerId: 'someone-else' })
    );
  });
});

describe('messages', () => {
  async function seedChat(chatId, userId, listenerId) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `chats/${chatId}`), {
        userId,
        listenerId,
        status: 'active',
      });
    });
  }

  test('a chat participant can send a message in their chat', async () => {
    await seedChat('chat-1', 'alice', 'grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'messages/msg-1'), { chatId: 'chat-1', senderId: 'alice', text: 'Hi' })
    );
  });

  test('someone outside the chat cannot send a message in it', async () => {
    await seedChat('chat-1', 'alice', 'grace');

    const db = testEnv.authenticatedContext('mallory').firestore();
    await assertFails(
      setDoc(doc(db, 'messages/msg-1'), { chatId: 'chat-1', senderId: 'mallory', text: 'Hi' })
    );
  });

  test('a participant cannot send a message while the chat is still pending (FR 5.5)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'chats/chat-1'), {
        userId: 'alice',
        listenerId: 'grace',
        status: 'pending',
      });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'messages/msg-1'), { chatId: 'chat-1', senderId: 'alice', text: 'Hi' })
    );
  });

  test('a chat participant can read messages in their chat', async () => {
    await seedChat('chat-1', 'alice', 'grace');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'messages/msg-1'), {
        chatId: 'chat-1',
        senderId: 'alice',
        text: 'Hi',
      });
    });

    const db = testEnv.authenticatedContext('grace').firestore();
    await assertSucceeds(getDoc(doc(db, 'messages/msg-1')));
  });

  test('someone outside the chat cannot read its messages', async () => {
    await seedChat('chat-1', 'alice', 'grace');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'messages/msg-1'), {
        chatId: 'chat-1',
        senderId: 'alice',
        text: 'Hi',
      });
    });

    const db = testEnv.authenticatedContext('mallory').firestore();
    await assertFails(getDoc(doc(db, 'messages/msg-1')));
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
