// The moderator queue page (FR 7.1). Firestore Security Rules are the
// real gatekeeper — this page just gives a moderator a list to work
// from. Needs moderator.js loaded first.

function showQueueMessage(text) {
  var box = document.getElementById('queue-message');
  if (box) box.textContent = text;
}

function escapeForDisplay(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function describeItem(item) {
  if (item.itemType === 'report') return 'Report: ' + item.reason;
  if (item.type === 'contact-sharing') return 'Blocked contact-sharing attempt';
  if (item.type === 'crisis') return 'Crisis wording';
  if (item.type === 'abusive-language') return 'Abusive language';
  return item.type || 'Flag';
}

function renderQueueRow(item) {
  var row = document.createElement('li');
  var ageText = item.createdAt ? new Date(item.createdAt.toMillis()).toLocaleString() : 'unknown time';

  row.innerHTML =
    '<strong>Severity ' + item.severity + '</strong> — ' + escapeForDisplay(describeItem(item)) +
    '<br><span class="resource-meta">' + ageText + '</span>';

  var openButton = document.createElement('a');
  openButton.href = 'moderator-case.html?chatId=' + encodeURIComponent(item.chatId) +
    '&itemType=' + encodeURIComponent(item.itemType) + '&itemId=' + encodeURIComponent(item.id);
  openButton.textContent = 'Open case';
  openButton.style.display = 'inline-block';
  openButton.style.width = 'auto';
  openButton.style.marginTop = '0.5rem';
  row.appendChild(document.createElement('br'));
  row.appendChild(openButton);

  return row;
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
      });
  });
}

document.addEventListener('DOMContentLoaded', checkModeratorAndStart);
