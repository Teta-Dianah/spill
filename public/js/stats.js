// The admin's anonymised statistics page (stats.html, FR 7.3): counts of
// people, chats, mood change and flags, with no personal data, and where
// each pilot goal from the SRS stands.
//
// It reads only what an admin may read (firestore.rules): accounts and
// listener records, which it only ever counts; chatStats and safetyTally,
// which hold no people or text; and the audit log. It never reads chats,
// messages, flags or reports (BR 4). Needs firebase-init.js,
// home-summary.js and stats-summary.js loaded first.

function showStatsMessage(text) {
  var box = document.getElementById('stats-message');
  if (box) box.textContent = text;
}

function readAll(collectionName) {
  return firebase
    .firestore()
    .collection(collectionName)
    .get()
    .then(function (snapshot) {
      return snapshot.docs.map(function (docSnap) {
        return docSnap.data();
      });
    });
}

// Fills a list with rows of [title, detail].
function fillList(listId, rows) {
  var list = document.getElementById(listId);
  if (!list) return;
  list.innerHTML = '';
  rows.forEach(function (row) {
    list.appendChild(makeItemRow(row[0], row[1]));
  });
}

// One pilot goal: "Now 62% of 13. Goal met." or "Too few to show yet".
function goalRow(title, part, total, goalPercent, countWord) {
  var status = goalStatus(part, total, goalPercent);
  var detail = 'Goal: ' + goalPercent + '%. ';
  if (status === null) {
    detail += TOO_FEW + ' (' + total + ' so far, ' + MIN_GROUP + ' needed).';
  } else {
    detail += 'Now ' + percentText(part, total) + ' of ' + total + ' ' + countWord + ': ' + status + '.';
  }
  return [title, detail];
}

// A breakdown such as "better, the same, worse" is only shown once the
// group is big enough, for the same reason as percentages.
function countsOrTooFew(total, text) {
  return total < MIN_GROUP ? TOO_FEW : text;
}

function showStats(data) {
  var people = summariseAccounts(data.accounts);
  var chats = summariseChats(data.chatStats);
  var safety = summariseSafety(data.tallies, data.audit);
  var listeners = data.listeners.filter(function (listener) {
    return listener.status === 'approved';
  });
  var availableNow = listeners.filter(function (listener) {
    return listener.available === true;
  }).length;

  setStat('stat-users', String(people.users));
  setStat('stat-chats', String(chats.chats));
  setStat('stat-raised', String(safety.raised));
  setStat('stat-reviewed', String(safety.reviewed));

  fillList('goal-list', [
    goalRow('Looking for support for the first time', people.firstTimeYes, people.firstTimeAnswered, 50, 'who answered'),
    goalRow('Felt better after a chat', chats.better, chats.chats, 60, 'chats'),
    goalRow('Would use Spill again', chats.useAgainYes, chats.useAgainAnswered, 70, 'answers'),
    [
      'Screening catches crisis and contact-sharing messages',
      'Goal: 90% of each. Measured on labelled test messages, not here: see docs/screening-report.md.',
    ],
  ]);

  var topics = Object.keys(chats.topics)
    .map(function (topic) {
      return topicWord(topic) + ' ' + chats.topics[topic];
    })
    .join(', ');

  fillList('chat-list', [
    ['Average change in mood', countsOrTooFew(chats.chats, changeText(chats.changeTotal, chats.chats) + ' on the 1 to 5 scale')],
    ['Better, the same, worse', countsOrTooFew(chats.chats, chats.better + ' better, ' + chats.same + ' the same, ' + chats.worse + ' worse')],
    [
      'Found the chat helpful',
      countsOrTooFew(chats.ratingAnswered, percentText(chats.helpful, chats.ratingAnswered) + ' of ' + chats.ratingAnswered + ' who answered'),
    ],
    [
      'Would use Spill again',
      countsOrTooFew(
        chats.useAgainAnswered,
        chats.useAgainYes + ' yes, ' + chats.useAgainNo + ' no, ' + chats.useAgainNotSure + ' not sure'
      ),
    ],
    ['Topics', countsOrTooFew(chats.chats, topics || 'None yet')],
  ]);

  fillList('people-list', [
    ['People with an account', String(people.users)],
    ['Aged 16 to 17, and 18 to 25', countsOrTooFew(people.users, people.youngerBand + ' and ' + people.olderBand)],
    ['Approved listeners', String(listeners.length)],
    ['Listeners available now', String(availableNow)],
  ]);

  fillList('safety-list', [
    ['Crisis flags', String(safety.crisis)],
    ['Contact-sharing attempts blocked', String(safety.contactSharing)],
    ['Abusive language flags', String(safety.abusiveLanguage)],
    ['Reports by people in a chat', String(safety.reports)],
    ['Flags and reports reviewed by moderators', String(safety.reviewed)],
    ['Cases opened by moderators', String(safety.casesOpened)],
  ]);

  document.getElementById('stats-home').hidden = false;
}

function loadStats() {
  Promise.all([
    readAll('accounts'),
    readAll('listeners'),
    readAll('chatStats'),
    readAll('safetyTally'),
    readAll('auditLog'),
  ])
    .then(function (results) {
      showStats({ accounts: results[0], listeners: results[1], chatStats: results[2], tallies: results[3], audit: results[4] });
    })
    .catch(function (error) {
      showStatsMessage('Could not load the statistics. Please try again.');
      console.error(error);
    });
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
        if (!accountDoc.exists || accountDoc.data().role !== 'admin') {
          showStatsMessage('This page is for admins.');
          return;
        }
        loadStats();
      })
      .catch(function (error) {
        showStatsMessage('Could not load your account. Please try again.');
        console.error(error);
      });
  });
});
