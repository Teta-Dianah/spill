// The chat screen: real-time messages via Firestore listeners, no
// polling (FR 4.3, FR 4.7, NFR 2), with every message screened before
// it's sent (FR 6.1-6.4). Needs screening.js loaded first.
//
// firestore.rules independently re-checks crisis/contact-sharing with
// its own small, fixed patterns — so what this file decides is not the
// final word. The "clean" path below has a fallback for exactly that
// case: if a plain write is refused, the rules caught something this
// file's screening missed, and we retry rather than just failing.

function getChatId() {
  return new URLSearchParams(window.location.search).get('chatId');
}

function showChatMessage(text) {
  var box = document.getElementById('chat-message');
  if (box) box.textContent = text;
}

function showChatStatus(text) {
  var box = document.getElementById('chat-status');
  if (box) box.textContent = text;
}

function escapeForDisplay(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMessages(docs, myUid) {
  var list = document.getElementById('message-list');
  if (!list) return;

  var messages = [];
  docs.forEach(function (docSnap) {
    messages.push(docSnap.data());
  });

  // A message you just sent has no createdAt yet locally (the real
  // server timestamp arrives a moment later), so treat that as "now"
  // rather than the start of time — otherwise it would briefly jump to
  // the top of the list instead of the bottom.
  messages.sort(function (a, b) {
    var aTime = a.createdAt ? a.createdAt.toMillis() : Date.now();
    var bTime = b.createdAt ? b.createdAt.toMillis() : Date.now();
    return aTime - bTime;
  });

  list.innerHTML = '';
  if (messages.length === 0) {
    list.innerHTML = '<li>No messages yet. Say hello.</li>';
    return;
  }

  messages.forEach(function (message) {
    var item = document.createElement('li');
    var who = message.senderId === myUid ? 'You' : 'Them';
    item.innerHTML = '<strong>' + who + ':</strong> ' + escapeForDisplay(message.text);
    list.appendChild(item);
  });
}

function listenForMessages(chatId, myUid) {
  firebase
    .firestore()
    .collection('messages')
    .where('chatId', '==', chatId)
    .onSnapshot(function (snapshot) {
      renderMessages(snapshot.docs, myUid);
    });
}

var currentChat = null;

function listenForChatStatus(chatId) {
  firebase
    .firestore()
    .collection('chats')
    .doc(chatId)
    .onSnapshot(function (docSnap) {
      if (!docSnap.exists) return;

      var chat = docSnap.data();
      currentChat = chat;
      var topicLabel = chat.topic ? ' — ' + chat.topic : '';
      var statusText = 'Chat in progress' + topicLabel;
      if (chat.status === 'pending') statusText = 'Waiting for the listener to accept...' + topicLabel;
      if (chat.status === 'ended') statusText = 'This chat has ended.' + topicLabel;
      showChatStatus(statusText);

      var messageForm = document.getElementById('message-form');
      var endChatButton = document.getElementById('end-chat-button');
      var disabled = chat.status !== 'active';
      if (messageForm) {
        messageForm.messageText.disabled = disabled;
        messageForm.querySelector('button').disabled = disabled;
      }
      if (endChatButton) {
        endChatButton.hidden = disabled;
      }
    });
}

// FR 4.5: either side can end a chat any time, no reason needed.
// FR 3.2 / FR 4.6: only the user (not the listener) records a mood-after
// and an optional rating, since those describe how the chat felt to them.
function endChat(chatId, updates) {
  return firebase
    .firestore()
    .collection('chats')
    .doc(chatId)
    .update(
      Object.assign(
        {
          status: 'ended',
          endedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        updates
      )
    );
}

function markChatFlagged(batch, chatId) {
  var ref = firebase.firestore().collection('chatFlagged').doc(chatId);
  batch.set(ref, { chatId: chatId }, { merge: true });
}

// FR 6.1: a plain, unflagged message. This is also the fallback target
// for the retry below — the happy path for almost every message sent.
function sendPlainMessage(chatId, user, text) {
  return firebase
    .firestore()
    .collection('messages')
    .add({
      chatId: chatId,
      senderId: user.uid,
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
}

// FR 6.2: the message is still delivered. The message and its
// high-priority flag are written in one atomic batch — firestore.rules
// refuses a crisis message with no matching flag, so this is the only
// way a crisis message can be sent at all.
function sendCrisisMessage(chatId, user, text) {
  var db = firebase.firestore();
  var messageRef = db.collection('messages').doc();
  var flagRef = db.collection('flags').doc();
  var batch = db.batch();

  batch.set(messageRef, {
    chatId: chatId,
    senderId: user.uid,
    text: text,
    flagId: flagRef.id,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  batch.set(flagRef, {
    type: 'crisis',
    chatId: chatId,
    senderId: user.uid,
    messageId: messageRef.id,
    severity: 3,
    status: 'open',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  markChatFlagged(batch, chatId);

  return batch.commit();
}

// FR 6.3: contact-sharing is never delivered. A separate "blocked
// attempt" flag is written instead, since rules can only allow or deny a
// write, not create data of their own. A listener account sending this
// is a bigger trust problem than a user doing it, so it's flagged at
// higher severity. If the blocked text also had crisis wording, a
// crisis flag is raised too — the sender still gets help even though
// the message itself never goes out.
function sendBlockedAttempt(chatId, user, text, isListener, alsoHasCrisis) {
  var db = firebase.firestore();
  var batch = db.batch();

  var contactFlagRef = db.collection('flags').doc();
  batch.set(contactFlagRef, {
    type: 'contact-sharing',
    chatId: chatId,
    senderId: user.uid,
    blockedText: text,
    severity: isListener ? 3 : 2,
    status: 'open',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  if (alsoHasCrisis) {
    var crisisFlagRef = db.collection('flags').doc();
    batch.set(crisisFlagRef, {
      type: 'crisis',
      chatId: chatId,
      senderId: user.uid,
      severity: 3,
      status: 'open',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  markChatFlagged(batch, chatId);

  return batch.commit();
}

// FR 6.4: abusive language is flagged, but still delivered — the
// recipient can already end the chat at any time if they need to.
function sendAbuseFlaggedMessage(chatId, user, text) {
  var db = firebase.firestore();
  var messageRef = db.collection('messages').doc();
  var flagRef = db.collection('flags').doc();
  var batch = db.batch();

  batch.set(messageRef, {
    chatId: chatId,
    senderId: user.uid,
    text: text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  batch.set(flagRef, {
    type: 'abusive-language',
    chatId: chatId,
    senderId: user.uid,
    messageId: messageRef.id,
    severity: 1,
    status: 'open',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  markChatFlagged(batch, chatId);

  return batch.commit();
}

// Screens the message, then sends it the right way (FR 6.1-6.4).
function screenAndSendMessage(chatId, user, text, isListener, form) {
  var screened = screenMessage(text);

  if (screened.hasContactSharing) {
    sendBlockedAttempt(chatId, user, text, isListener, screened.hasCrisisLanguage)
      .then(function () {
        form.reset();
        showChatMessage("That message wasn't sent — don't share phone numbers, emails, links or other ways to contact you here. Everything stays on Spill.");
        if (screened.hasCrisisLanguage) showCrisisCard();
      })
      .catch(function (error) {
        showChatMessage('Could not send that message. Please try again.');
        console.error(error);
      });
    return;
  }

  if (screened.hasCrisisLanguage) {
    sendCrisisMessage(chatId, user, text)
      .then(function () {
        form.reset();
        showChatMessage('');
        showCrisisCard();
      })
      .catch(function (error) {
        showChatMessage('Could not send that message. Please try again.');
        console.error(error);
      });
    return;
  }

  if (screened.hasAbusiveLanguage) {
    sendAbuseFlaggedMessage(chatId, user, text)
      .then(function () {
        form.reset();
        showChatMessage('');
      })
      .catch(function (error) {
        showChatMessage('Could not send that message. Please try again.');
        console.error(error);
      });
    return;
  }

  // Looks clean to this file's screening. firestore.rules checks crisis
  // and contact-sharing wording again, independently, with its own fixed
  // patterns — if a plain write is refused, that's what happened, and a
  // crisis message must still get through somehow (it is never allowed
  // to be silently blocked), so we retry as a crisis batch before giving
  // up and treating it as a blocked contact-sharing attempt.
  sendPlainMessage(chatId, user, text)
    .then(function () {
      form.reset();
      showChatMessage('');
    })
    .catch(function () {
      sendCrisisMessage(chatId, user, text)
        .then(function () {
          form.reset();
          showChatMessage('');
          showCrisisCard();
        })
        .catch(function () {
          sendBlockedAttempt(chatId, user, text, isListener, false)
            .then(function () {
              form.reset();
              showChatMessage("That message wasn't sent — don't share phone numbers, emails, links or other ways to contact you here. Everything stays on Spill.");
            })
            .catch(function (error) {
              showChatMessage('Could not send that message. Please try again.');
              console.error(error);
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
  var chatId = getChatId();
  if (!chatId) {
    showChatMessage('No chat was specified.');
    return;
  }

  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
      return;
    }

    listenForChatStatus(chatId);
    listenForMessages(chatId, user.uid);
  });

  var form = document.getElementById('message-form');
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var user = firebase.auth().currentUser;
      if (!user) return;

      var text = form.messageText.value.trim();
      if (!text) return;

      var isListener = !!(currentChat && user.uid === currentChat.listenerId);
      screenAndSendMessage(chatId, user, text, isListener, form);
    });
  }

  var endChatButton = document.getElementById('end-chat-button');
  var endChatForm = document.getElementById('end-chat-form');

  if (endChatButton) {
    endChatButton.addEventListener('click', function () {
      var user = firebase.auth().currentUser;
      if (!user || !currentChat) return;

      if (user.uid === currentChat.listenerId) {
        // The listener's side: just end it, no mood or rating to capture.
        endChat(chatId, {}).catch(function (error) {
          showChatMessage('Could not end the chat. Please try again.');
          console.error(error);
        });
        return;
      }

      // The user's side: capture a mood-after and optional rating first.
      endChatButton.hidden = true;
      if (endChatForm) endChatForm.hidden = false;
    });
  }

  if (endChatForm) {
    endChatForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var moodAfter = parseInt(endChatForm.moodAfter.value, 10);
      var ratingInput = endChatForm.querySelector('input[name="rating"]:checked');
      var rating = ratingInput ? ratingInput.value : null;
      var ratingComment = endChatForm.ratingComment.value.trim();

      endChat(chatId, {
        moodAfter: moodAfter,
        rating: rating,
        ratingComment: ratingComment,
      })
        .then(function () {
          window.location.href = 'dashboard.html';
        })
        .catch(function (error) {
          showChatMessage('Could not finish the chat. Please try again.');
          console.error(error);
        });
    });
  }
});
