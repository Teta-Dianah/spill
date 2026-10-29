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
const { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } = require('firebase/firestore');

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
  async function seedAccount(uid, ageBand, overrides = {}) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `accounts/${uid}`), {
        pseudonym: 'Test',
        role: 'user',
        ageBand,
        status: 'active',
        blockedUids: [],
        ...overrides,
      });
    });
  }

  // A listener needs both documents: listeners/{uid} for their approval
  // status, and accounts/{uid} like any other person, since
  // isEligibleListener now also checks the listener's own account isn't
  // suspended and hasn't blocked (or been blocked by) the requester.
  async function seedApprovedListener(uid, overrides = {}) {
    await seedAccount(uid, '18-25');
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

  test('a suspended user cannot request a chat (BR 7)', async () => {
    await seedAccount('alice', '18-25', { status: 'suspended' });
    await seedApprovedListener('grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'chats/chat-1'), { userId: 'alice', listenerId: 'grace', status: 'pending' })
    );
  });

  test('a user cannot request a chat with a suspended listener (BR 7)', async () => {
    await seedAccount('alice', '18-25');
    await seedApprovedListener('grace');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'accounts/grace'), {
        pseudonym: 'Grace', role: 'user', ageBand: '18-25', status: 'suspended', blockedUids: [],
      });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'chats/chat-1'), { userId: 'alice', listenerId: 'grace', status: 'pending' })
    );
  });

  test('a user cannot request a chat with a listener they have blocked (FR 6.6)', async () => {
    await seedAccount('alice', '18-25', { blockedUids: ['grace'] });
    await seedApprovedListener('grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'chats/chat-1'), { userId: 'alice', listenerId: 'grace', status: 'pending' })
    );
  });

  test('a user cannot request a chat with a listener who has blocked them (FR 6.6)', async () => {
    await seedAccount('alice', '18-25');
    await seedApprovedListener('grace', {});
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'accounts/grace'), {
        pseudonym: 'Grace', role: 'user', ageBand: '18-25', status: 'active', blockedUids: ['alice'],
      });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'chats/chat-1'), { userId: 'alice', listenerId: 'grace', status: 'pending' })
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

  test('a clean message is delivered normally', async () => {
    await seedChat('chat-1', 'alice', 'grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'messages/msg-2'), { chatId: 'chat-1', senderId: 'alice', text: 'Hi, how are you?' })
    );
  });

  test('a crisis message is refused when it has no matching flag (FR 6.2)', async () => {
    await seedChat('chat-1', 'alice', 'grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'messages/msg-3'), {
        chatId: 'chat-1',
        senderId: 'alice',
        text: 'I want to kill myself',
        flagId: 'flag-1',
      })
    );
  });

  test('a crisis message succeeds when batched with its flag (FR 6.2)', async () => {
    await seedChat('chat-1', 'alice', 'grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'messages/msg-4'), {
      chatId: 'chat-1',
      senderId: 'alice',
      text: 'I want to kill myself',
      flagId: 'flag-2',
    });
    batch.set(doc(db, 'flags/flag-2'), {
      type: 'crisis',
      chatId: 'chat-1',
      senderId: 'alice',
      severity: 3,
      status: 'open',
    });
    await assertSucceeds(batch.commit());
  });

  test('a contact-sharing message is refused outright (FR 6.3)', async () => {
    await seedChat('chat-1', 'alice', 'grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'messages/msg-5'), { chatId: 'chat-1', senderId: 'alice', text: 'call me at 0788123456' })
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

describe('chatCases', () => {
  async function seedChat(chatId, userId, listenerId) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `chats/${chatId}`), { userId, listenerId, status: 'active' });
    });
  }

  test('a chat participant can open a case for their own chat', async () => {
    await seedChat('chat-1', 'alice', 'grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(db, 'chatCases/chat-1'), { chatId: 'chat-1' }));
  });

  test('someone outside the chat cannot open a case for it', async () => {
    await seedChat('chat-1', 'alice', 'grace');

    const db = testEnv.authenticatedContext('mallory').firestore();
    await assertFails(setDoc(doc(db, 'chatCases/chat-1'), { chatId: 'chat-1' }));
  });
});

describe('flags and reports', () => {
  async function seedChat(chatId, userId, listenerId) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `chats/${chatId}`), { userId, listenerId, status: 'active' });
    });
  }

  async function seedModerator(uid) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `accounts/${uid}`), {
        pseudonym: 'Mod', role: 'moderator', status: 'active', blockedUids: [],
      });
    });
  }

  test('a chat participant can create a flag for their own chat', async () => {
    await seedChat('chat-1', 'alice', 'grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'flags/flag-1'), {
        type: 'abusive-language', chatId: 'chat-1', senderId: 'alice', severity: 1, status: 'open',
      })
    );
  });

  test('a non-moderator cannot read flags', async () => {
    await seedChat('chat-1', 'alice', 'grace');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'flags/flag-1'), { type: 'crisis', chatId: 'chat-1', senderId: 'alice' });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(db, 'flags/flag-1')));
  });

  test('a moderator can read a flag and resolve it with a reason (FR 6.8)', async () => {
    await seedChat('chat-1', 'alice', 'grace');
    await seedModerator('mod1');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'flags/flag-1'), {
        type: 'crisis', chatId: 'chat-1', senderId: 'alice', severity: 3, status: 'open',
      });
    });

    const db = testEnv.authenticatedContext('mod1').firestore();
    await assertSucceeds(getDoc(doc(db, 'flags/flag-1')));
    await assertSucceeds(
      updateDoc(doc(db, 'flags/flag-1'), { status: 'reviewed', action: 'dismiss', reason: 'Not needed' })
    );
  });

  test('a participant can report their chat', async () => {
    await seedChat('chat-1', 'alice', 'grace');

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'reports/report-1'), {
        chatId: 'chat-1', reporterId: 'alice', reportedId: 'grace',
        reason: 'Made me uncomfortable', severity: 2, status: 'open',
      })
    );
  });

  test('a non-moderator cannot read reports', async () => {
    await seedChat('chat-1', 'alice', 'grace');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'reports/report-1'), {
        chatId: 'chat-1', reporterId: 'alice', reportedId: 'grace', reason: 'test',
      });
    });

    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(db, 'reports/report-1')));
  });
});

describe('moderator access to chat content (BR 3, BR 4)', () => {
  async function seedCasedChat(chatId) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `chats/${chatId}`), { userId: 'alice', listenerId: 'grace', status: 'ended' });
      await setDoc(doc(context.firestore(), `chatCases/${chatId}`), { chatId });
      await setDoc(doc(context.firestore(), 'accounts/mod1'), {
        pseudonym: 'Mod', role: 'moderator', status: 'active', blockedUids: [],
      });
      await setDoc(doc(context.firestore(), 'accounts/admin1'), {
        pseudonym: 'Admin', role: 'admin', status: 'active', blockedUids: [],
      });
    });
  }

  test('a moderator can read a chat once a case exists for it', async () => {
    await seedCasedChat('chat-1');

    const db = testEnv.authenticatedContext('mod1').firestore();
    await assertSucceeds(getDoc(doc(db, 'chats/chat-1')));
  });

  test('a moderator cannot read a chat with no case opened for it', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'chats/chat-2'), { userId: 'alice', listenerId: 'grace', status: 'ended' });
      await setDoc(doc(context.firestore(), 'accounts/mod1'), {
        pseudonym: 'Mod', role: 'moderator', status: 'active', blockedUids: [],
      });
    });

    const db = testEnv.authenticatedContext('mod1').firestore();
    await assertFails(getDoc(doc(db, 'chats/chat-2')));
  });

  test('an admin can never read a chat, even with a case (BR 4)', async () => {
    await seedCasedChat('chat-1');

    const db = testEnv.authenticatedContext('admin1').firestore();
    await assertFails(getDoc(doc(db, 'chats/chat-1')));
  });
});

describe('auditLog', () => {
  async function seedModerator(uid) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `accounts/${uid}`), {
        pseudonym: 'Mod', role: 'moderator', status: 'active', blockedUids: [],
      });
    });
  }

  test('a moderator can log their own action', async () => {
    await seedModerator('mod1');

    const db = testEnv.authenticatedContext('mod1').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'auditLog/entry-1'), {
        actorId: 'mod1', action: 'opened_case', targetType: 'chat', targetId: 'chat-1',
      })
    );
  });

  test('a moderator cannot log an action claiming to be someone else', async () => {
    await seedModerator('mod1');

    const db = testEnv.authenticatedContext('mod1').firestore();
    await assertFails(
      setDoc(doc(db, 'auditLog/entry-1'), { actorId: 'someone-else', action: 'opened_case' })
    );
  });

  test('a regular user cannot write to the audit log', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      setDoc(doc(db, 'auditLog/entry-1'), { actorId: 'alice', action: 'opened_case' })
    );
  });

  test('audit log entries cannot be updated, even by a moderator (NFR 19)', async () => {
    await seedModerator('mod1');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'auditLog/entry-1'), { actorId: 'mod1', action: 'opened_case' });
    });

    const db = testEnv.authenticatedContext('mod1').firestore();
    await assertFails(updateDoc(doc(db, 'auditLog/entry-1'), { action: 'dismissed' }));
  });

  test('audit log entries cannot be deleted, even by a moderator (NFR 19)', async () => {
    await seedModerator('mod1');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'auditLog/entry-1'), { actorId: 'mod1', action: 'opened_case' });
    });

    const db = testEnv.authenticatedContext('mod1').firestore();
    await assertFails(deleteDoc(doc(db, 'auditLog/entry-1')));
  });
});

describe('admin and moderator account updates', () => {
  async function seedAccounts() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'accounts/admin1'), {
        pseudonym: 'Admin', role: 'admin', status: 'active', blockedUids: [],
      });
      await setDoc(doc(context.firestore(), 'accounts/mod1'), {
        pseudonym: 'Mod', role: 'moderator', status: 'active', blockedUids: [],
      });
      await setDoc(doc(context.firestore(), 'accounts/bob'), {
        pseudonym: 'Bob', role: 'user', status: 'active', blockedUids: [],
      });
    });
  }

  test('an admin can change role and status', async () => {
    await seedAccounts();

    const db = testEnv.authenticatedContext('admin1').firestore();
    await assertSucceeds(updateDoc(doc(db, 'accounts/bob'), { role: 'moderator', status: 'active' }));
  });

  test('an admin cannot change other fields, like pseudonym', async () => {
    await seedAccounts();

    const db = testEnv.authenticatedContext('admin1').firestore();
    await assertFails(updateDoc(doc(db, 'accounts/bob'), { pseudonym: 'Renamed' }));
  });

  test('a moderator can suspend an account (status only, FR 6.8)', async () => {
    await seedAccounts();

    const db = testEnv.authenticatedContext('mod1').firestore();
    await assertSucceeds(updateDoc(doc(db, 'accounts/bob'), { status: 'suspended' }));
  });

  test('a moderator cannot change role', async () => {
    await seedAccounts();

    const db = testEnv.authenticatedContext('mod1').firestore();
    await assertFails(updateDoc(doc(db, 'accounts/bob'), { role: 'admin' }));
  });

  test('a user cannot un-suspend their own account (BR 7)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'accounts/bob'), {
        pseudonym: 'Bob', role: 'user', status: 'suspended', blockedUids: [],
      });
    });

    const db = testEnv.authenticatedContext('bob').firestore();
    await assertFails(updateDoc(doc(db, 'accounts/bob'), { status: 'active' }));
  });
});
