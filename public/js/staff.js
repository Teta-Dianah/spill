// The staff home page (staff.html): where a moderator or an admin lands
// after signing in. It shows what is waiting for them, with a link to
// each tool. Ordinary users and listeners never come here; sign-in sends
// them to their own pages (homePageFor in staff-links.js).
//
// The counts are only a summary. firestore.rules decides what each role
// can read, so a moderator's page never loads admin data and the other
// way round. Needs firebase-init.js and auth.js loaded first.

function showStaffMessage(text) {
  var box = document.getElementById('staff-message');
  if (box) box.textContent = text;
}

// Counts the documents a query finds and writes the number into the
// element with this id. If the query is refused or fails, it shows a dash
// instead of a number, so the page never shows a wrong count.
function showCount(elementId, query) {
  var box = document.getElementById(elementId);
  if (!box) return;

  query
    .get()
    .then(function (snapshot) {
      box.textContent = String(snapshot.size);
    })
    .catch(function (error) {
      box.textContent = '–';
      console.error(error);
    });
}

function showModeratorHome() {
  var db = firebase.firestore();
  document.getElementById('moderator-home').hidden = false;

  // The queue holds open flags and open reports together.
  var box = document.getElementById('open-items-count');
  Promise.all([
    db.collection('flags').where('status', '==', 'open').get(),
    db.collection('reports').where('status', '==', 'open').get(),
  ])
    .then(function (results) {
      box.textContent = String(results[0].size + results[1].size);
    })
    .catch(function (error) {
      box.textContent = '–';
      console.error(error);
    });
}

function showAdminHome() {
  var db = firebase.firestore();
  document.getElementById('admin-home').hidden = false;
  showCount('pending-listeners-count', db.collection('listeners').where('status', '==', 'pending'));
  showCount('pending-suggestions-count', db.collection('termSuggestions').where('status', '==', 'pending'));
}

document.addEventListener('DOMContentLoaded', function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
      return;
    }

    firebase
      .firestore()
      .collection('accounts')
      .doc(user.uid)
      .get()
      .then(function (accountDoc) {
        var account = accountDoc.exists ? accountDoc.data() : {};
        document.getElementById('staff-name').textContent = account.pseudonym || 'Staff';

        if (account.role === 'moderator') {
          document.getElementById('staff-role').textContent = 'Signed in as a moderator';
          showModeratorHome();
        } else if (account.role === 'admin') {
          document.getElementById('staff-role').textContent = 'Signed in as an admin';
          showAdminHome();
        } else {
          showStaffMessage('This page is for moderators and admins.');
        }
      })
      .catch(function (error) {
        showStaffMessage('Could not load your account. Please try again.');
        console.error(error);
      });
  });

  var signOutButton = document.getElementById('sign-out-button');
  if (signOutButton) {
    signOutButton.addEventListener('click', function () {
      signOutUser().then(function () {
        window.location.href = 'index.html';
      });
    });
  }
});
