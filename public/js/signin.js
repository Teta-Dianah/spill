// Wires up the sign-in form on signin.html (FR 1.4).
// Needs auth.js and staff-links.js loaded first.

function showSigninMessage(text) {
  var box = document.getElementById('signin-message');
  if (box) box.textContent = text;
}

// Looks up the person's role and listener record, then opens their home
// page (homePageFor in staff-links.js). If the lookup fails for any
// reason, they go to the ordinary dashboard, which works for everyone.
function goToHomePage(uid) {
  var db = firebase.firestore();
  Promise.all([
    db.collection('accounts').doc(uid).get(),
    db.collection('listeners').doc(uid).get(),
  ])
    .then(function (docs) {
      var role = docs[0].exists ? docs[0].data().role : null;
      var isApprovedListener = docs[1].exists && docs[1].data().status === 'approved';
      window.location.href = homePageFor(role, isApprovedListener);
    })
    .catch(function () {
      window.location.href = 'dashboard.html';
    });
}

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('signin-form');
  if (!form) return;

  // Sent here by idle-signout.js after 30 minutes away (FR 1.4).
  // Shown once only.
  try {
    if (window.sessionStorage.getItem('spill-signed-out-idle') === 'yes') {
      window.sessionStorage.removeItem('spill-signed-out-idle');
      showSigninMessage('You were signed out after 30 minutes away. Sign in again to carry on.');
    }
  } catch {
    // Nothing to show.
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var email = form.email.value.trim();
    var password = form.password.value;

    // Signing in is activity, so the 30-minute timer starts afresh
    // (idle-signout.js).
    if (window.markActive) window.markActive();

    signIn(email, password)
      .then(function (credential) {
        goToHomePage(credential.user.uid);
      })
      .catch(function () {
        // Always the same message, whether the email exists or the
        // password is wrong (NFR: sign-in errors must not reveal
        // whether an email exists).
        showSigninMessage('That email and password combination did not work. Please try again.');
      });
  });
});
