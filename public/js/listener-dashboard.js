// Wires up the listener dashboard: status, availability and active chats
// (FR 5.4, FR 5.5). Needs auth.js and listeners.js loaded first.

var MAX_CONCURRENT_CHATS = 2;

function showStatusMessage(text) {
  var box = document.getElementById('status-message');
  if (box) box.textContent = text;
}

function showAvailabilityNote(text) {
  var box = document.getElementById('availability-note');
  if (box) box.textContent = text;
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
      list.innerHTML = '';

      if (snapshot.empty) {
        list.innerHTML = '<li>No active chats right now.</li>';
      }

      snapshot.forEach(function (docSnap) {
        var item = document.createElement('li');
        var link = document.createElement('a');
        link.href = 'chat.html?chatId=' + docSnap.id;
        link.textContent = 'Open chat (' + (docSnap.data().topic || 'no topic') + ')';
        item.appendChild(link);
        list.appendChild(item);
      });

      // FR 5.5: a listener can only take two chats at once. There's no
      // Cloud Function to enforce this on a server, so once they're at
      // the limit we simply turn their own availability off.
      if (snapshot.size >= MAX_CONCURRENT_CHATS && toggle && toggle.checked) {
        setListenerAvailability(uid, false).then(function () {
          toggle.checked = false;
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
// Accepting is blocked once they're already at the 2-chat limit — checked
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

function renderPendingRequests(uid) {
  var list = document.getElementById('pending-requests');
  if (!list) return;

  firebase
    .firestore()
    .collection('chats')
    .where('listenerId', '==', uid)
    .where('status', '==', 'pending')
    .onSnapshot(function (snapshot) {
      list.innerHTML = '';

      if (snapshot.empty) {
        list.innerHTML = '<li>No incoming requests right now.</li>';
        return;
      }

      snapshot.forEach(function (docSnap) {
        var chatId = docSnap.id;
        var topic = docSnap.data().topic || 'no topic';

        var item = document.createElement('li');
        var label = document.createElement('span');
        label.textContent = 'Request (' + topic + ') ';
        item.appendChild(label);

        var acceptButton = document.createElement('button');
        acceptButton.type = 'button';
        acceptButton.textContent = 'Accept';
        acceptButton.addEventListener('click', function () {
          acceptChatRequest(uid, chatId);
        });
        item.appendChild(acceptButton);

        var declineButton = document.createElement('button');
        declineButton.type = 'button';
        declineButton.textContent = 'Decline';
        declineButton.addEventListener('click', function () {
          declineChatRequest(chatId);
        });
        item.appendChild(declineButton);

        list.appendChild(item);
      });
    });
}

function setUpAvailabilityToggle(uid, listener) {
  var toggle = document.getElementById('available-toggle');
  if (!toggle) return;

  toggle.checked = listener.available;

  if (!listener.trainingComplete) {
    toggle.disabled = true;
    showAvailabilityNote('Finish listener training before you can go available.');
    return;
  }

  toggle.addEventListener('change', function () {
    setListenerAvailability(uid, toggle.checked).catch(function () {
      showAvailabilityNote('Could not update your availability. Please try again.');
    });
  });
}

function startDashboard(uid) {
  getListener(uid, function (listener) {
    if (!listener) {
      showStatusMessage('You have not applied as a listener yet.');
      return;
    }

    if (listener.status === 'pending') {
      showStatusMessage('Your application is still waiting for admin review.');
      return;
    }

    if (listener.status === 'rejected') {
      showStatusMessage('Your application was not approved.');
      return;
    }

    showStatusMessage(
      'Approved' + (listener.clearedForMinors ? ', cleared to talk with 16-17 year olds.' : '.')
    );
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
