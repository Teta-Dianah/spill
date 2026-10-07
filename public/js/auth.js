// Sign-up, sign-in and sign-out (FR 1.1, FR 1.2, FR 1.4).
// Needs pseudonym.js and firebase-init.js loaded first.

function createAccountDocument(uid, ageBand) {
  var pseudonym = generatePseudonym();
  return firebase
    .firestore()
    .collection('accounts')
    .doc(uid)
    .set({
      pseudonym: pseudonym,
      ageBand: ageBand,
      role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(function () {
      return pseudonym;
    });
}

function registerUser(email, password, ageBand) {
  return firebase
    .auth()
    .createUserWithEmailAndPassword(email, password)
    .then(function (credential) {
      // FR 1.6: send a verification email. This is a "nice to have", so a
      // failure here (e.g. emulator doesn't send real email) shouldn't stop
      // the sign-up from finishing.
      credential.user.sendEmailVerification().catch(function (error) {
        console.error('Could not send verification email', error);
      });

      return createAccountDocument(credential.user.uid, ageBand);
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
function deleteAccount(uid) {
  return firebase
    .firestore()
    .collection('accounts')
    .doc(uid)
    .delete()
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
