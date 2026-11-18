// Tests for firestore.lockdown.rules, the rules deployed during a
// suspected data breach (docs/breach-procedure.md). They run on the
// emulator under their own project ID, so they never mix with the
// normal rules tests.

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, deleteDoc, collection, getDocs } = require('firebase/firestore');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-spill-lockdown',
    firestore: { rules: fs.readFileSync('firestore.lockdown.rules', 'utf8') },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'resources/helpline-1'), { name: 'Example Helpline' });
    await setDoc(doc(db, 'accounts/ada'), { pseudonym: 'Ada', role: 'admin' });
    await setDoc(doc(db, 'accounts/mona'), { pseudonym: 'Mona', role: 'moderator' });
    await setDoc(doc(db, 'accounts/alice'), { pseudonym: 'Alice', role: 'user' });
    await setDoc(doc(db, 'chats/chat-1'), { userId: 'alice', listenerId: 'grace', status: 'active' });
    await setDoc(doc(db, 'messages/msg-1'), { chatId: 'chat-1', senderId: 'alice', text: 'Hi' });
    await setDoc(doc(db, 'flags/flag-1'), { type: 'crisis', chatId: 'chat-1', status: 'open' });
  });
});

afterAll(async () => {
  await testEnv.clearFirestore();
  await testEnv.cleanup();
});

describe('lock-down rules (breach procedure, NFR 14)', () => {
  test('the helplines can still be read by anyone, signed out too (BR 8)', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'resources/helpline-1')));
    await assertSucceeds(getDocs(collection(db, 'resources')));
  });

  test('nobody can change the helplines, not even an admin', async () => {
    const db = testEnv.authenticatedContext('ada').firestore();
    await assertFails(setDoc(doc(db, 'resources/helpline-2'), { name: 'New' }));
    await assertFails(deleteDoc(doc(db, 'resources/helpline-1')));
  });

  test.each([['alice'], ['grace'], ['mona'], ['ada']])('%s can read nothing else', async (uid) => {
    const db = testEnv.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(db, 'accounts/' + uid)));
    await assertFails(getDoc(doc(db, 'chats/chat-1')));
    await assertFails(getDoc(doc(db, 'messages/msg-1')));
    await assertFails(getDoc(doc(db, 'flags/flag-1')));
  });

  test('nobody can write anything', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'messages/msg-2'), { chatId: 'chat-1', senderId: 'alice', text: 'Hi' }));
    await assertFails(setDoc(doc(db, 'moods/mood-1'), { uid: 'alice', score: 3 }));
    await assertFails(deleteDoc(doc(db, 'accounts/alice')));
  });

  test('a signed-out visitor can read nothing but the helplines', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'accounts/alice')));
    await assertFails(getDoc(doc(db, 'messages/msg-1')));
  });
});
