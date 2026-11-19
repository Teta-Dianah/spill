// The moderator queue page (FR 7.1). Firestore Security Rules are the
// real gatekeeper: this page just gives a moderator a list to work
// from. Needs moderator.js loaded first.

function showQueueMessage(text) {
  var box = document.getElementById('queue-message');
  if (box) box.textContent = text;
}

function renderQueue() {
  var list = document.getElementById('queue-list');
  if (!list) return;

  loadQueueItems(function (items) {
    list.innerHTML = '';

    if (items.length === 0) {
      list.innerHTML = '<li>Nothing in the queue right now.</li>';
      return;
    }

    items.forEach(function (item) {
      list.appendChild(renderQueueRow(item));
    });
  }, function () {
    list.innerHTML = '';
    var note = document.createElement('li');
    note.textContent = 'The queue could not load. Check your connection and refresh the page.';
    list.appendChild(note);
  });
}

function checkModeratorAndStart() {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      showQueueMessage('Please sign in as a moderator to view the queue.');
      return;
    }

    firebase
      .firestore()
      .collection('accounts')
      .doc(user.uid)
      .get()
      .then(function (accountDoc) {
        var role = accountDoc.exists ? accountDoc.data().role : null;
        if (role !== 'moderator') {
          showQueueMessage('You do not have access to this page.');
          return;
        }

        renderQueue();
      })
      .catch(function (error) {
        showQueueMessage('The queue could not load. Check your connection and refresh the page.');
        console.error(error);
      });
  });
}

document.addEventListener('DOMContentLoaded', checkModeratorAndStart);
