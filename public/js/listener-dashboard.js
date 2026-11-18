// Wires up the listener dashboard: what is waiting at a glance, incoming
// requests, status, availability and active chats (FR 5.4, FR 5.5).
// Needs auth.js, listeners.js and home-summary.js loaded first.

var MAX_CONCURRENT_CHATS = 2;

function showStatusMessage(text) {
  var box = document.getElementById('status-message');
  if (box) box.textContent = text;
}

function showListenerMessage(text) {
  var box = document.getElementById('listener-message');
  if (box) box.textContent = text;
}

function showAvailabilityNote(text) {
  var box = document.getElementById('availability-note');
  if (box) box.textContent = text;
}

function renderListenerName(uid) {
  firebase
    .firestore()
    .collection('accounts')
    .doc(uid)
    .get()
    .then(function (accountDoc) {
      var box = document.getElementById('listener-name');
      if (box) box.textContent = accountDoc.exists ? accountDoc.data().pseudonym : 'listener';
    });
}

function showAvailableStat(available) {
  setStat('stat-available', available ? 'Available' : 'Away');
}

function chatTime(chat) {
  return chat.createdAt ? chat.createdAt.toMillis() : 0;
}

function renderActiveChats(uid) {
  var list = document.getElementById('active-chats');
  var toggle = document.getElementById('available-toggle');
  if (!list) return;

  firebase
    .firestore()
    .collection('chats')
    .where('listenerId', '==', uid)
    .where('status', '==', 'active')
    .onSnapshot(function (snapshot) {
      setStat('stat-active', snapshot.size + ' of ' + MAX_CONCURRENT_CHATS);

      list.innerHTML = '';
      if (snapshot.empty) {
        showListNote(list, 'No active chats right now.');
      }

      var now = Date.now();
      snapshot.forEach(function (docSnap) {
        var chat = docSnap.data();
        list.appendChild(
          makeItemRow(
            topicWord(chat.topic),
            'Asked ' + timeAgo(chatTime(chat), now),
            'Open chat',
            'chat.html?chatId=' + encodeURIComponent(docSnap.id)
          )
        );
      });

      // FR 5.5: a listener can only take two chats at once. There's no
      // Cloud Function to enforce this on a server, so once they're at
      // the limit we simply turn their own availability off.
      if (snapshot.size >= MAX_CONCURRENT_CHATS && toggle && toggle.checked) {
        setListenerAvailability(uid, false).then(function () {
          toggle.checked = false;
          showAvailableStat(false);
          showAvailabilityNote('You reached the ' + MAX_CONCURRENT_CHATS + '-chat limit, so availability was turned off.');
        });
      }
    });
}

function countActiveChats(uid, onCounted) {
  firebase
    .firestore()
    .collection('chats')
    .where('listenerId', '==', uid)
    .where('status', '==', 'active')
    .get()
    .then(function (snapshot) {
      onCounted(snapshot.size);
    });
}

function showPendingMessage(text) {
  var box = document.getElementById('pending-message');
  if (box) box.textContent = text;
}

// FR 5.5: the listener reviews each request and accepts or declines it.
// Accepting is blocked once they're already at the 2-chat limit; checked
// here, not just by turning availability off reactively, since a new
// request could already be pending before that kicks in.
function acceptChatRequest(uid, chatId) {
  countActiveChats(uid, function (count) {
    if (count >= MAX_CONCURRENT_CHATS) {
      showPendingMessage('You already have ' + MAX_CONCURRENT_CHATS + ' active chats. End one before accepting another.');
      return;
    }

    firebase
      .firestore()
      .collection('chats')
      .doc(chatId)
      .update({ status: 'active' })
      .catch(function () {
        showPendingMessage('Could not accept that chat. Please try again.');
      });
  });
}

function declineChatRequest(chatId) {
  firebase
    .firestore()
    .collection('chats')
    .doc(chatId)
    .update({ status: 'declined' })
    .catch(function () {
      showPendingMessage('Could not decline that chat. Please try again.');
    });
}

// One request: the topic, how long they have waited and how they said
// they were feeling, then Accept and Decline.
function renderRequestRow(uid, chatId, chat, now) {
  var detail = 'Asked ' + timeAgo(chatTime(chat), now);
  if (chat.moodBefore) {
    detail += ' · feeling ' + moodWord(chat.moodBefore).toLowerCase() + ' (' + chat.moodBefore + ' out of 5)';
  }
  var row = makeItemRow(topicWord(chat.topic), detail);

  var buttons = document.createElement('div');
  buttons.className = 'item-buttons';

  var acceptButton = document.createElement('button');
  acceptButton.type = 'button';
  acceptButton.textContent = 'Accept';
  acceptButton.addEventListener('click', function () {
    acceptChatRequest(uid, chatId);
  });
  buttons.appendChild(acceptButton);

  var declineButton = document.createElement('button');
  declineButton.type = 'button';
  declineButton.textContent = 'Decline';
  declineButton.className = 'button-secondary';
  declineButton.addEventListener('click', function () {
    declineChatRequest(chatId);
  });
  buttons.appendChild(declineButton);

  row.appendChild(buttons);
  return row;
}

function renderPendingRequests(uid) {
  var list = document.getElementById('pending-requests');
  if (!list) return;

  firebase
    .firestore()
    .collection('chats')
    .where('listenerId', '==', uid)
    .where('status', '==', 'pending')
    .onSnapshot(function (snapshot) {
      setStat('stat-requests', String(snapshot.size), snapshot.size > 0);

      if (snapshot.empty) {
        showListNote(list, 'No incoming requests right now.');
        return;
      }

      list.innerHTML = '';
      var now = Date.now();
      snapshot.forEach(function (docSnap) {
        list.appendChild(renderRequestRow(uid, docSnap.id, docSnap.data(), now));
      });
    });
}

function setUpAvailabilityToggle(uid, listener) {
  var toggle = document.getElementById('available-toggle');
  if (!toggle) return;

  toggle.checked = listener.available;
  showAvailableStat(listener.available);

  if (!listener.trainingComplete) {
    toggle.disabled = true;
    showAvailabilityNote('Finish listener training before you can go available.');
    return;
  }

  toggle.addEventListener('change', function () {
    setListenerAvailability(uid, toggle.checked)
      .then(function () {
        showAvailableStat(toggle.checked);
      })
      .catch(function () {
        showAvailabilityNote('Could not update your availability. Please try again.');
      });
  });
}

function startDashboard(uid) {
  getListener(uid, function (listener) {
    if (!listener) {
      showListenerMessage('You have not applied as a listener yet. You can apply from your personal dashboard.');
      return;
    }

    if (listener.status === 'pending') {
      showListenerMessage('Your application is still waiting for admin review.');
      return;
    }

    if (listener.status === 'rejected') {
      showListenerMessage('Your application was not approved.');
      return;
    }

    document.getElementById('listener-home').hidden = false;
    showStatusMessage(
      'Approved' + (listener.clearedForMinors ? ', cleared to talk with 16-17 year olds.' : '.')
    );
    setStat('stat-training', listener.trainingComplete ? 'Done' : 'Not done', !listener.trainingComplete);
    document.getElementById('training-card').hidden = listener.trainingComplete === true;

    setUpAvailabilityToggle(uid, listener);
    renderPendingRequests(uid);
    renderActiveChats(uid);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
      return;
    }
    renderListenerName(user.uid);
    startDashboard(user.uid);
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
