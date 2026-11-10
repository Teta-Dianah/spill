// The chat screen: real-time messages via Firestore listeners, no
// polling (FR 4.3, FR 4.7, NFR 2), with every message screened before
// it's sent (FR 6.1-6.4). Needs screening.js loaded first.
//
// firestore.rules independently re-checks crisis/contact-sharing with
// its own small, fixed patterns too, so what this file decides is not
// the final word on whether a write is accepted. But a flag is only
// ever created for what this file's own screening actually found — if
// a message this file considered clean is refused anyway, that's shown
// as a plain error, not guessed at and retried as a crisis or blocked
// attempt. Guessing risks raising a flag (crisis, especially) for a
// message that was refused for some unrelated reason.

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

// Admin-added screening terms (FR 7.1), loaded once per chat session.
// Until they load, or if loading fails, screening still uses the
// built-in lists in screening.js.
var extraScreeningTerms = null;

function loadExtraScreeningTerms() {
  var db = firebase.firestore();
  var categories = ['crisis', 'abuse', 'contact'];

  Promise.all(
    categories.map(function (category) {
      return db.collection('termLists').doc(category).get();
    })
  )
    .then(function (docs) {
      var lists = {};
      categories.forEach(function (category, index) {
        lists[category] = docs[index].exists ? docs[index].data().terms : [];
      });
      extraScreeningTerms = lists;
    })
    .catch(function (error) {
      console.error(error);
    });
}

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
      var safetyActions = document.getElementById('safety-actions');
      var disabled = chat.status !== 'active';
      if (messageForm) {
        messageForm.messageText.disabled = disabled;
        messageForm.querySelector('button').disabled = disabled;
      }
      if (safetyActions) {
        safetyActions.hidden = disabled;
      }
    });
}

// Who's on the other side of this chat from the signed-in user?
function otherParticipant(chat, myUid) {
  return chat.userId === myUid ? chat.listenerId : chat.userId;
}

// FR 6.5: either participant can report the chat with a reason. Writing
// the chatFlagged marker in the same batch is what lets a moderator
// later open a case on it (BR 3) — a report on its own doesn't give
// anyone new access to anything.
function sendReport(chatId, user, otherUid, reason) {
  var db = firebase.firestore();
  var reportRef = db.collection('reports').doc();
  var batch = db.batch();

  batch.set(reportRef, {
    chatId: chatId,
    reporterId: user.uid,
    reportedId: otherUid,
    reason: reason,
    severity: 2,
    status: 'open',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  markChatFlagged(batch, chatId);

  return batch.commit();
}

// FR 6.6, BR 5: either side can block the other at any time, no reason
// needed, and isn't matched with them again (see isEligibleListener in
// firestore.rules). Blocking also ends the current chat — there's no
// reason to keep talking to someone you just blocked.
function blockPerson(chatId, user, otherUid) {
  var accountUpdate = firebase
    .firestore()
    .collection('accounts')
    .doc(user.uid)
    .update({ blockedUids: firebase.firestore.FieldValue.arrayUnion(otherUid) });

  return accountUpdate.then(function () {
    return endChat(chatId, {});
  });
}

// FR 4.5: either side can end a chat any time, no reason needed.
// FR 3.2: only the user (not the listener) records a mood-after, since
// that describes how the chat felt to them — the chat is already ended
// by the time this runs, moodAfter included, so it's never optional or
// separable from ending the chat the way the rating is (see saveRating).
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

// FR 4.6: a separate, optional step after the chat has already ended
// and the mood check-in is already stored — rating can be skipped
// without skipping the (required) mood check-in that came before it.
function saveRating(chatId, rating, ratingComment) {
  return firebase
    .firestore()
    .collection('chats')
    .doc(chatId)
    .update({ rating: rating, ratingComment: ratingComment });
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
  var screened = screenMessage(text, extraScreeningTerms);

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

  // Looks clean to this file's screening, so it's sent as a plain
  // message. If the write is refused anyway (firestore.rules has its
  // own independent, fixed crisis/contact-sharing check), that's not
  // retried as a crisis or blocked-attempt flag — this file's own
  // screening didn't find crisis wording here, so raising a crisis flag
  // would be a guess, not a fact. Just show the error.
  sendPlainMessage(chatId, user, text)
    .then(function () {
      form.reset();
      showChatMessage('');
    })
    .catch(function (error) {
      showChatMessage('Could not send that message. Please try again.');
      console.error(error);
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
    loadExtraScreeningTerms();
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

  var reportButton = document.getElementById('report-button');
  var reportForm = document.getElementById('report-form');
  var cancelReportButton = document.getElementById('cancel-report-button');
  var blockButton = document.getElementById('block-button');

  if (reportButton && reportForm) {
    reportButton.addEventListener('click', function () {
      reportForm.hidden = false;
    });
  }

  if (cancelReportButton && reportForm) {
    cancelReportButton.addEventListener('click', function () {
      reportForm.hidden = true;
    });
  }

  if (reportForm) {
    reportForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var user = firebase.auth().currentUser;
      if (!user || !currentChat) return;

      var reason = reportForm.reportReason.value.trim();
      if (!reason) return;

      sendReport(chatId, user, otherParticipant(currentChat, user.uid), reason)
        .then(function () {
          reportForm.reset();
          reportForm.hidden = true;
          showChatMessage('Thanks — a moderator will review this.');
        })
        .catch(function (error) {
          showChatMessage('Could not send that report. Please try again.');
          console.error(error);
        });
    });
  }

  var blockConfirm = document.getElementById('block-confirm');
  var confirmBlockButton = document.getElementById('confirm-block-button');
  var cancelBlockButton = document.getElementById('cancel-block-button');

  if (blockButton && blockConfirm) {
    blockButton.addEventListener('click', function () {
      blockConfirm.hidden = false;
    });
  }

  if (cancelBlockButton && blockConfirm) {
    cancelBlockButton.addEventListener('click', function () {
      blockConfirm.hidden = true;
    });
  }

  if (confirmBlockButton) {
    confirmBlockButton.addEventListener('click', function () {
      var user = firebase.auth().currentUser;
      if (!user || !currentChat) return;

      blockPerson(chatId, user, otherParticipant(currentChat, user.uid))
        .then(function () {
          if (blockConfirm) blockConfirm.hidden = true;
          showChatMessage('Blocked. This chat has ended.');
        })
        .catch(function (error) {
          showChatMessage('Could not block that person. Please try again.');
          console.error(error);
        });
    });
  }

  var endChatButton = document.getElementById('end-chat-button');
  var moodAfterForm = document.getElementById('mood-after-form');
  var ratingForm = document.getElementById('rating-form');
  var skipRatingButton = document.getElementById('skip-rating-button');

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

      // FR 3.2: the user's side always goes through a required mood
      // check-in first. The rating is a separate, optional step after
      // that, not part of the same form — it can be skipped on its own
      // without skipping the mood check-in.
      endChatButton.hidden = true;
      if (moodAfterForm) moodAfterForm.hidden = false;
    });
  }

  if (moodAfterForm) {
    moodAfterForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var moodAfter = parseInt(moodAfterForm.moodAfter.value, 10);

      endChat(chatId, { moodAfter: moodAfter })
        .then(function () {
          moodAfterForm.hidden = true;
          if (ratingForm) ratingForm.hidden = false;
        })
        .catch(function (error) {
          showChatMessage('Could not finish the chat. Please try again.');
          console.error(error);
        });
    });
  }

  if (ratingForm) {
    ratingForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var ratingInput = ratingForm.querySelector('input[name="rating"]:checked');
      var rating = ratingInput ? ratingInput.value : null;
      var ratingComment = ratingForm.ratingComment.value.trim();

      saveRating(chatId, rating, ratingComment)
        .then(function () {
          window.location.href = 'dashboard.html';
        })
        .catch(function (error) {
          showChatMessage('Could not save that. Please try again.');
          console.error(error);
        });
    });
  }

  if (skipRatingButton) {
    skipRatingButton.addEventListener('click', function () {
      window.location.href = 'dashboard.html';
    });
  }
});
