// The staff home page (staff.html): where a moderator or an admin lands
// after signing in. It shows what is waiting for them at a glance, the
// items themselves, and what they did recently. Ordinary users and
// listeners never come here; sign-in sends them to their own pages
// (homePageFor in staff-links.js).
//
// This page is only a summary. firestore.rules decides what each role
// can read, so a moderator's page never loads admin data and the other
// way round, and no message text is ever shown here (BR 3).
// Needs firebase-init.js, auth.js, moderator.js and home-summary.js
// loaded first.

// How many items each list shows before "see all".
var HOME_LIST_LENGTH = 5;

function showStaffMessage(text) {
  var box = document.getElementById('staff-message');
  if (box) box.textContent = text;
}

function timeOf(data, field) {
  return data[field] ? data[field].toMillis() : 0;
}

// What this person did most recently, newest first. Every moderator and
// admin action is written to the audit log (FR 6.9), so this is read
// from there.
function renderRecentActions(listId, uid) {
  var list = document.getElementById(listId);
  if (!list) return;

  firebase
    .firestore()
    .collection('auditLog')
    .where('actorId', '==', uid)
    .get()
    .then(function (snapshot) {
      var entries = snapshot.docs.map(function (docSnap) {
        return docSnap.data();
      });
      entries.sort(function (a, b) {
        return timeOf(b, 'createdAt') - timeOf(a, 'createdAt');
      });

      if (entries.length === 0) {
        showListNote(list, 'Nothing yet. Your actions will show here.');
        return;
      }

      var now = Date.now();
      list.innerHTML = '';
      entries.slice(0, HOME_LIST_LENGTH).forEach(function (entry) {
        list.appendChild(makeItemRow(describeAction(entry.action), timeAgo(timeOf(entry, 'createdAt'), now)));
      });
    })
    .catch(function (error) {
      showListNote(list, 'Could not load your recent actions.');
      console.error(error);
    });
}

// ---- Moderator

function showModeratorHome(uid) {
  document.getElementById('moderator-home').hidden = false;

  var list = document.getElementById('urgent-list');
  // loadQueueItems (moderator.js) gives the open flags and reports
  // together, most serious first, then oldest first.
  loadQueueItems(function (items) {
    var summary = queueSummary(
      items.map(function (item) {
        return { itemType: item.itemType, type: item.type, time: timeOf(item, 'createdAt') };
      })
    );

    setStat('stat-crisis', String(summary.crisis), summary.crisis > 0);
    setStat('stat-flags', String(summary.otherFlags));
    setStat('stat-reports', String(summary.reports));
    setStat('stat-oldest', summary.oldest ? waitingFor(summary.oldest, Date.now()) : 'None');

    if (items.length === 0) {
      showListNote(list, 'Nothing in the queue right now.');
      return;
    }

    list.innerHTML = '';
    items.slice(0, HOME_LIST_LENGTH).forEach(function (item) {
      list.appendChild(renderQueueRow(item));
    });
    document.getElementById('whole-queue-link').textContent = 'See the whole queue (' + items.length + ')';
  });

  renderRecentActions('moderator-actions', uid);
}

// ---- Admin

function showWaitingApplications(listeners) {
  var list = document.getElementById('waiting-applications');
  var waiting = listeners.filter(function (listener) {
    return listener.status === 'pending';
  });
  waiting.sort(function (a, b) {
    return timeOf(a, 'appliedAt') - timeOf(b, 'appliedAt');
  });

  if (waiting.length === 0) {
    showListNote(list, 'No applications waiting.');
    return;
  }

  // Only the pseudonym is shown, never anything that could identify
  // the person (NFR 11).
  var db = firebase.firestore();
  var shown = waiting.slice(0, HOME_LIST_LENGTH);
  Promise.all(
    shown.map(function (listener) {
      return db.collection('accounts').doc(listener.uid).get();
    })
  ).then(function (accountDocs) {
    var now = Date.now();
    list.innerHTML = '';
    shown.forEach(function (listener, index) {
      var name = accountDocs[index].exists ? accountDocs[index].data().pseudonym : 'An applicant';
      list.appendChild(
        makeItemRow(name, 'Applied ' + timeAgo(timeOf(listener, 'appliedAt'), now), 'Review', 'admin-listeners.html')
      );
    });
  });
}

function showWaitingSuggestions(db) {
  var list = document.getElementById('waiting-suggestions');
  db.collection('termSuggestions')
    .where('status', '==', 'pending')
    .get()
    .then(function (snapshot) {
      setStat('stat-suggestions', String(snapshot.size), snapshot.size > 0);

      if (snapshot.empty) {
        showListNote(list, 'No suggested terms waiting.');
        return;
      }

      var suggestions = snapshot.docs.map(function (docSnap) {
        return docSnap.data();
      });
      suggestions.sort(function (a, b) {
        return timeOf(a, 'createdAt') - timeOf(b, 'createdAt');
      });

      var now = Date.now();
      list.innerHTML = '';
      suggestions.slice(0, HOME_LIST_LENGTH).forEach(function (suggestion) {
        var detail = listName(suggestion.category) + ' · suggested ' + timeAgo(timeOf(suggestion, 'createdAt'), now);
        list.appendChild(makeItemRow('"' + suggestion.phrase + '"', detail, 'Review', 'admin-terms.html'));
      });
    })
    .catch(function (error) {
      setStat('stat-suggestions', '?');
      showListNote(list, 'Could not load the suggested terms.');
      console.error(error);
    });
}

function showAdminHome(uid) {
  var db = firebase.firestore();
  document.getElementById('admin-home').hidden = false;

  db.collection('listeners')
    .get()
    .then(function (snapshot) {
      var listeners = snapshot.docs.map(function (docSnap) {
        var data = docSnap.data();
        data.uid = docSnap.id;
        return data;
      });

      var summary = listenerSummary(listeners);
      setStat('stat-applications', String(summary.waiting), summary.waiting > 0);
      setStat('stat-approved', String(summary.approved));
      setStat('stat-available-now', String(summary.availableNow));
      showWaitingApplications(listeners);
    })
    .catch(function (error) {
      ['stat-applications', 'stat-approved', 'stat-available-now'].forEach(function (id) {
        setStat(id, '?');
      });
      showListNote(document.getElementById('waiting-applications'), 'Could not load the applications.');
      console.error(error);
    });

  showWaitingSuggestions(db);
  renderRecentActions('admin-actions', uid);
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
        document.getElementById('staff-name').textContent = account.pseudonym || 'there';

        if (account.role === 'moderator') {
          document.getElementById('staff-role').textContent = 'Moderator';
          showModeratorHome(user.uid);
        } else if (account.role === 'admin') {
          document.getElementById('staff-role').textContent = 'Admin';
          showAdminHome(user.uid);
        } else {
          showStaffMessage('This page is for moderators and admins. Your own page is the dashboard.');
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
