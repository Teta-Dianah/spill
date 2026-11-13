// Wires up the dashboard: mood check-in, mood history and sign-out
// (FR 1.4, FR 3.1, FR 3.3). Needs auth.js and mood.js loaded first.

function showMoodMessage(text) {
  var box = document.getElementById('mood-message');
  if (box) box.textContent = text;
}

// Shows the account's pseudonym, since this is the only "name" a user
// ever has in Spill (FR 1.2) and it should stay visible, not just appear
// once in the sign-up message.
function renderPseudonym(uid) {
  var box = document.getElementById('pseudonym-display');
  if (!box) return;

  firebase
    .firestore()
    .collection('accounts')
    .doc(uid)
    .get()
    .then(function (accountDoc) {
      if (accountDoc.exists) {
        box.textContent = 'You are known here as ' + accountDoc.data().pseudonym;
      }
    });
}

// Shows links to the listener, moderator or admin pages, but only to
// someone signed in with that role. Ordinary users never see this
// section. The links are a shortcut only: firestore.rules decides who
// can actually read or change anything on those pages.
function renderStaffLinks(uid) {
  var section = document.getElementById('staff-links-section');
  var list = document.getElementById('staff-links');
  if (!section || !list) return;

  var db = firebase.firestore();
  Promise.all([
    db.collection('accounts').doc(uid).get(),
    db.collection('listeners').doc(uid).get(),
  ])
    .then(function (docs) {
      var role = docs[0].exists ? docs[0].data().role : null;
      var isApprovedListener = docs[1].exists && docs[1].data().status === 'approved';
      var links = staffLinksFor(role, isApprovedListener);
      if (links.length === 0) return;

      list.innerHTML = '';
      links.forEach(function (link) {
        var item = document.createElement('li');
        var anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.textContent = link.label;
        item.appendChild(anchor);
        list.appendChild(item);
      });
      section.hidden = false;
    })
    .catch(function (error) {
      console.error('Could not load staff links', error);
    });
}

// FR 3.4: a private "how has this month been" summary. Off by default in
// the sense that it only ever shows to the signed-in user themselves —
// there's no sharing feature at all in version 1.0.
function renderMonthlyRecap(entries) {
  var box = document.getElementById('monthly-recap');
  if (!box) return;

  var now = new Date();
  var thisMonthEntries = entries.filter(function (entry) {
    if (!entry.createdAt) return false;
    var entryDate = entry.createdAt.toDate();
    return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
  });

  if (thisMonthEntries.length === 0) {
    box.textContent = 'No check-ins yet this month.';
    return;
  }

  var total = thisMonthEntries.reduce(function (sum, entry) {
    return sum + entry.score;
  }, 0);
  var average = Math.round((total / thisMonthEntries.length) * 10) / 10;

  box.textContent =
    'This month: ' + thisMonthEntries.length + ' check-in(s), average mood ' + average + ' out of 5.';
}

function renderMoodHistory(uid) {
  var list = document.getElementById('mood-history');
  if (!list) return;

  loadMoodHistory(uid, function (entries) {
    list.innerHTML = '';

    if (entries.length === 0) {
      list.innerHTML = '<li>No check-ins yet.</li>';
    } else {
      entries.forEach(function (entry) {
        var item = document.createElement('li');
        item.textContent = 'Mood: ' + entry.score + (entry.note ? ' - ' + entry.note : '');
        list.appendChild(item);
      });
    }

    renderMonthlyRecap(entries);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
      return;
    }
    renderPseudonym(user.uid);
    renderStaffLinks(user.uid);
    renderMoodHistory(user.uid);
  });

  var moodForm = document.getElementById('mood-form');
  if (moodForm) {
    moodForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var user = firebase.auth().currentUser;
      if (!user) return;

      var score = parseInt(moodForm.score.value, 10);
      var note = moodForm.note.value.trim();

      recordMood(user.uid, score, note)
        .then(function () {
          moodForm.reset();
          showMoodMessage('Mood recorded.');
          renderMoodHistory(user.uid);
        })
        .catch(function (error) {
          showMoodMessage(error.message);
        });
    });
  }

  var signOutButton = document.getElementById('sign-out-button');
  if (signOutButton) {
    signOutButton.addEventListener('click', function () {
      signOutUser().then(function () {
        window.location.href = 'index.html';
      });
    });
  }

  var deleteButton = document.getElementById('delete-account-button');
  if (deleteButton) {
    deleteButton.addEventListener('click', function () {
      var user = firebase.auth().currentUser;
      if (!user) return;

      var confirmed = window.confirm('This deletes your account and mood history. This cannot be undone. Continue?');
      if (!confirmed) return;

      deleteAccount(user.uid)
        .then(function () {
          window.location.href = 'index.html';
        })
        .catch(function () {
          showMoodMessage('Could not delete your account. Please try signing in again and retry.');
        });
    });
  }
});
