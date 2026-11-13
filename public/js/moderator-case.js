// The case view: a moderator opens a chat flagged or reported against
// it, sees the transcript, and takes an action with a reason (FR 7.3).
// Opening the case and taking the action are both logged (FR 6.9, BR 3).
// Needs moderator.js loaded first.

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function showCaseMessage(text) {
  var box = document.getElementById('case-message');
  if (box) box.textContent = text;
}

function describeItem(item) {
  if (item.itemType === 'report') {
    return 'Reported by a participant — severity ' + item.severity + '. Reason: ' + item.reason;
  }
  var label = item.type === 'contact-sharing' ? 'Blocked contact-sharing attempt'
    : item.type === 'crisis' ? 'Crisis wording'
    : item.type === 'abusive-language' ? 'Abusive language'
    : item.type || 'Flag';
  return label + ' — severity ' + item.severity + (item.blockedText ? '. Blocked text: ' + item.blockedText : '');
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

function renderTranscript(messages) {
  var list = document.getElementById('transcript-list');
  if (!list) return;

  list.innerHTML = '';
  if (messages.length === 0) {
    list.innerHTML = '<li>No messages in this chat.</li>';
    return;
  }

  messages.forEach(function (message) {
    var item = document.createElement('li');
    item.textContent = message.senderId + ': ' + message.text;
    list.appendChild(item);

    getPseudonym(message.senderId, function (pseudonym) {
      item.textContent = pseudonym + ': ' + message.text;
    });
  });
}

function loadAndRenderCase(chatId, itemType, itemId, moderatorUid) {
  loadQueueItem(itemType, itemId, function (item) {
    if (!item) {
      showCaseMessage('Could not find that item.');
      return;
    }

    document.getElementById('item-summary').textContent = describeItem(item);
    document.getElementById('case-details').hidden = false;

    openCase(chatId, moderatorUid, itemType, itemId)
      .then(function () {
        loadChatMessages(chatId, function (messages) {
          renderTranscript(messages);
          document.getElementById('case-transcript').hidden = false;
          document.getElementById('action-form').hidden = false;
        });
      })
      .catch(function (error) {
        showCaseMessage('Could not open this case. Please try again.');
        console.error(error);
      });

    var actionForm = document.getElementById('action-form');
    if (actionForm) {
      actionForm.addEventListener('submit', function (event) {
        event.preventDefault();

        var action = actionForm.actionSelect.value;
        var reason = actionForm.actionReason.value.trim();
        if (!reason) return;

        applyModeratorAction(item, action, reason, moderatorUid)
          .then(function () {
            actionForm.hidden = true;
            showCaseMessage('Action applied and logged.');
          })
          .catch(function (error) {
            showCaseMessage('Could not apply that action. Please try again.');
            console.error(error);
          });
      });
    }
  });
}

function checkModeratorAndStart() {
  var chatId = getQueryParam('chatId');
  var itemType = getQueryParam('itemType');
  var itemId = getQueryParam('itemId');

  if (!chatId || !itemType || !itemId) {
    showCaseMessage('No case was specified.');
    return;
  }

  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      showCaseMessage('Please sign in as a moderator to view this case.');
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
          showCaseMessage('You do not have access to this page.');
          return;
        }

        loadAndRenderCase(chatId, itemType, itemId, user.uid);
      });
  });
}

document.addEventListener('DOMContentLoaded', checkModeratorAndStart);
