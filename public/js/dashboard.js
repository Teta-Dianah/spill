// Wires up the dashboard: what is going on for this person at a glance,
// the mood check-in, recent check-ins and sign-out (FR 1.4, FR 3.1,
// FR 3.3, FR 3.4). Needs auth.js, mood.js and home-summary.js loaded
// first.

function showMoodMessage(text) {
  var box = document.getElementById('mood-message');
  if (box) box.textContent = text;
}

// Today's date above the greeting, such as "Tuesday 17 November".
function renderTodayDate() {
  var box = document.getElementById('today-date');
  if (!box) return;
  box.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Shows the account's pseudonym, since this is the only "name" a user
// ever has in Spill (FR 1.2) and it should stay visible.
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
        box.textContent = accountDoc.data().pseudonym;
      }
    });
}

// If this person has a chat open with a listener, the first thing they
// see is a way back into it, and the "Need to talk?" card steps aside.
function renderOpenChat(uid) {
  var card = document.getElementById('open-chat');
  var talkCard = document.getElementById('talk-card');
  if (!card) return;

  firebase
    .firestore()
    .collection('chats')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get()
    .then(function (snapshot) {
      if (snapshot.empty) return;

      var chatDoc = snapshot.docs[0];
      document.getElementById('open-chat-text').textContent =
        'You are talking with a listener about ' + topicWord(chatDoc.data().topic).toLowerCase() + '.';
      document.getElementById('open-chat-link').href = 'chat.html?chatId=' + encodeURIComponent(chatDoc.id);
      card.hidden = false;
      if (talkCard) talkCard.hidden = true;
    })
    .catch(function (error) {
      console.error('Could not check for an open chat', error);
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

// The three numbers at the top (FR 3.4). They are private: only the
// signed-in person ever sees them.
function renderMoodStats(entries) {
  var now = Date.now();
  var summary = moodSummary(entries, now);

  setStat('stat-month-count', String(summary.countThisMonth));
  setStat('stat-month-average', summary.averageThisMonth === null ? 'None' : String(summary.averageThisMonth));
  setStat('stat-last-check-in', lastCheckInText(summary.lastCheckIn, now));

  var note = document.getElementById('checked-in-today');
  if (note) note.hidden = !summary.checkedInToday;
}

// A small bar for each of the last 7 check-ins, oldest on the left. The
// bars are a picture only; the list under them says the same in words.
function renderMoodBars(entries) {
  var box = document.getElementById('mood-bars');
  if (!box) return;

  var recent = entries.slice(0, 7).reverse();
  box.innerHTML = '';
  box.hidden = recent.length === 0;
  if (recent.length === 0) return;

  recent.forEach(function (entry) {
    var bar = document.createElement('span');
    // Number() keeps anything but a number out of the class name.
    bar.className = 'mood-bar mood-bar-' + (Number(entry.score) || 0);
    box.appendChild(bar);
  });

  var words = recent.map(function (entry) {
    return moodWord(entry.score);
  });
  box.setAttribute('aria-label', 'Your last ' + recent.length + ' check-ins, oldest first: ' + words.join(', '));
}

function renderMoodHistory(uid) {
  var list = document.getElementById('mood-history');
  if (!list) return;

  loadMoodHistory(uid, function (entries) {
    var now = Date.now();
    var timed = entries.map(function (entry) {
      return {
        score: entry.score,
        note: entry.note,
        tags: entry.tags || [],
        time: entry.createdAt ? entry.createdAt.toMillis() : 0,
      };
    });

    renderMoodStats(timed);
    renderMoodBars(timed);

    list.innerHTML = '';
    if (timed.length === 0) {
      showListNote(list, 'No check-ins yet. They will show here once you save one.');
      return;
    }

    timed.slice(0, 7).forEach(function (entry) {
      var title = moodWord(entry.score) + ' (' + entry.score + ' out of 5)';
      var detail = timeAgo(entry.time, now);
      var tags = tagWords(entry.tags);
      if (tags) detail += ' · ' + tags;
      if (entry.note) detail += ' · ' + entry.note;
      list.appendChild(makeItemRow(title, detail));
    });
  }, function () {
    showListNote(list, 'Your check-ins could not load. Check your connection and refresh the page.');
    ['stat-month-count', 'stat-month-average', 'stat-last-check-in'].forEach(function (id) {
      setStat(id, '?');
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  renderTodayDate();

  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
      return;
    }
    renderPseudonym(user.uid);
    renderOpenChat(user.uid);
    renderStaffLinks(user.uid);
    renderMoodHistory(user.uid);
    removeOldChats(user.uid, 'userId'); // NFR 13, old-chats.js
  });

  var moodForm = document.getElementById('mood-form');
  if (moodForm) {
    moodForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var user = firebase.auth().currentUser;
      if (!user) return;

      var score = parseInt(moodForm.score.value, 10);
      var note = moodForm.note.value.trim();
      var tags = [];
      moodForm.querySelectorAll('input[name="tags"]:checked').forEach(function (box) {
        tags.push(box.value);
      });

      recordMood(user.uid, score, note, tags)
        .then(function () {
          moodForm.reset();
          showMoodMessage('Check-in saved. Thank you.');
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
