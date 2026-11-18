// Sign-up, sign-in and sign-out (FR 1.1, FR 1.2, FR 1.4).
// Needs pseudonym.js and firebase-init.js loaded first.

// The version of the privacy notice and terms (privacy.html) that a new
// account agrees to (FR 1.3, NFR 14). Change it whenever privacy.html
// changes in a way people should agree to again. A page test checks that
// privacy.html shows this same version.
var PRIVACY_NOTICE_VERSION = '2026-11-18';

function createAccountDocument(uid, ageBand, firstTimeSeekingHelp) {
  var pseudonym = generatePseudonym();
  return firebase
    .firestore()
    .collection('accounts')
    .doc(uid)
    .set({
      pseudonym: pseudonym,
      ageBand: ageBand,
      // FR 1.6: asked once at sign-up, used to measure how many pilot
      // users are trying this kind of support for the first time (H1).
      firstTimeSeekingHelp: firstTimeSeekingHelp,
      role: 'user',
      // BR 7: a moderator can suspend an account; it stays suspended
      // until they reinstate it. FR 6.6: who this account has blocked,
      // so they're never matched again.
      status: 'active',
      blockedUids: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      // FR 1.3: a record that this person agreed to the privacy notice
      // and terms, which version, and when. firestore.rules refuses an
      // account without it.
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      consentedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(function () {
      return pseudonym;
    });
}

function registerUser(email, password, ageBand, firstTimeSeekingHelp) {
  return firebase
    .auth()
    .createUserWithEmailAndPassword(email, password)
    .then(function (credential) {
      // FR 1.7: send a verification email. This is a "nice to have", so a
      // failure here (e.g. emulator doesn't send real email) shouldn't stop
      // the sign-up from finishing.
      credential.user.sendEmailVerification().catch(function (error) {
        console.error('Could not send verification email', error);
      });

      return createAccountDocument(credential.user.uid, ageBand, firstTimeSeekingHelp);
    });
}

function signIn(email, password) {
  return firebase.auth().signInWithEmailAndPassword(email, password);
}

function signOutUser() {
  return firebase.auth().signOut();
}

// FR 1.5: lets a user remove their account and data. Version 1.0 has no
// safety cases yet (that's Sprint 3), so for now this always deletes
// everything straight away.
// Deletes every mood entry the person has saved (FR 1.5). A batch can
// hold 500 writes, so the entries are removed up to 400 at a time, one
// batch after another, until none are left.
function deleteOwnMoods(uid) {
  var db = firebase.firestore();
  return db
    .collection('moods')
    .where('uid', '==', uid)
    .limit(400)
    .get()
    .then(function (snapshot) {
      if (snapshot.empty) return null;

      var batch = db.batch();
      snapshot.forEach(function (docSnap) {
        batch.delete(docSnap.ref);
      });
      return batch.commit().then(function () {
        return deleteOwnMoods(uid);
      });
    });
}

// Spill is for people aged 16 to 25 (FR 1.1, NFR 14). Rwanda's data
// protection law needs a guardian's consent for a child under 16, so a
// declared age under 16 is refused before any account is made.
function isAllowedAgeBand(ageBand) {
  return ageBand === '16-17' || ageBand === '18-25';
}

// Deletes the account and the person's own data (FR 1.5): their mood
// history first, then the account itself. If they ever applied to be a
// listener, their listener record and their private application answers
// go in the same batch as the account, so nothing they wrote is left
// behind. Chats, flags and reports are not removed here: moderators may
// still need them for a safety case.
function deleteAccount(uid) {
  var db = firebase.firestore();
  var listenerRef = db.collection('listeners').doc(uid);
  var applicationRef = db.collection('listenerApplications').doc(uid);

  // A delete of something that isn't there would be refused by the
  // rules, so look first and only delete what exists.
  return deleteOwnMoods(uid)
    .then(function () {
      return Promise.all([listenerRef.get(), applicationRef.get()]);
    })
    .then(function (docs) {
      var batch = db.batch();
      batch.delete(db.collection('accounts').doc(uid));
      if (docs[0].exists) batch.delete(listenerRef);
      if (docs[1].exists) batch.delete(applicationRef);
      return batch.commit();
    })
    .then(function () {
      return firebase.auth().currentUser.delete();
    });
}

// Makes these available to the page-specific scripts (signup.js, signin.js,
// dashboard.js) that load after this file.
window.registerUser = registerUser;
window.signIn = signIn;
window.signOutUser = signOutUser;
window.deleteAccount = deleteAccount;
window.isAllowedAgeBand = isAllowedAgeBand;
window.PRIVACY_NOTICE_VERSION = PRIVACY_NOTICE_VERSION;
