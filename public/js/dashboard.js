// Wires up the dashboard: mood check-in, mood history and sign-out
// (FR 1.4, FR 3.1, FR 3.3). Needs auth.js and mood.js loaded first.

function showMoodMessage(text) {
  var box = document.getElementById('mood-message');
  if (box) box.textContent = text;
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
