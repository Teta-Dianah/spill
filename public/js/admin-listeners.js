// Lets an admin approve, reject and clear listeners for minors (FR 5.2).
// Firestore Security Rules are the real gatekeeper — this page just gives
// an admin a form to use. Needs listeners.js loaded first.

function showAdminListenersMessage(text) {
  var box = document.getElementById('admin-listeners-message');
  if (box) box.textContent = text;
}

function getPseudonym(uid, onLoaded) {
  firebase
    .firestore()
    .collection('accounts')
    .doc(uid)
    .get()
    .then(function (accountDoc) {
      onLoaded(accountDoc.exists ? accountDoc.data().pseudonym : uid);
    });
}

function renderListenerRow(listener) {
  var row = document.createElement('li');
  var label = document.createElement('span');
  label.textContent = listener.uid + ' — ' + listener.status +
    (listener.clearedForMinors ? ' (cleared for minors)' : '');
  row.appendChild(label);

  getPseudonym(listener.uid, function (pseudonym) {
    label.textContent = pseudonym + ' — ' + listener.status +
      (listener.clearedForMinors ? ' (cleared for minors)' : '');
  });

  if (listener.status !== 'approved') {
    var approveButton = document.createElement('button');
    approveButton.type = 'button';
    approveButton.textContent = 'Approve';
    approveButton.addEventListener('click', function () {
      approveListener(listener.uid, false).then(renderListeners);
    });
    row.appendChild(approveButton);

    var approveMinorsButton = document.createElement('button');
    approveMinorsButton.type = 'button';
    approveMinorsButton.textContent = 'Approve + clear for minors';
    approveMinorsButton.addEventListener('click', function () {
      approveListener(listener.uid, true).then(renderListeners);
    });
    row.appendChild(approveMinorsButton);

    var rejectButton = document.createElement('button');
    rejectButton.type = 'button';
    rejectButton.textContent = 'Reject';
    rejectButton.addEventListener('click', function () {
      rejectListener(listener.uid).then(renderListeners);
    });
    row.appendChild(rejectButton);
  }

  return row;
}

function renderListeners() {
  var list = document.getElementById('listeners-list');
  if (!list) return;

  loadAllListeners(function (listeners) {
    list.innerHTML = '';

    if (listeners.length === 0) {
      list.innerHTML = '<li>No applications yet.</li>';
      return;
    }

    listeners.forEach(function (listener) {
      list.appendChild(renderListenerRow(listener));
    });
  });
}

function checkAdminAndStart() {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      showAdminListenersMessage('Please sign in as an admin to manage listeners.');
      return;
    }

    firebase
      .firestore()
      .collection('accounts')
      .doc(user.uid)
      .get()
      .then(function (accountDoc) {
        var role = accountDoc.exists ? accountDoc.data().role : null;
        if (role !== 'admin') {
          showAdminListenersMessage('You do not have access to this page.');
          return;
        }

        renderListeners();
      });
  });
}

document.addEventListener('DOMContentLoaded', checkAdminAndStart);
