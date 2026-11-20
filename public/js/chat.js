// The chat screen: real-time messages via Firestore listeners, no
// polling (FR 4.3, FR 4.7, NFR 2), with every message screened before
// it's sent (FR 6.1-6.4). Needs screening.js loaded first.
//
// Screening here is the term lists in screening.js, plus a second
// opinion from the model check in model-check.js when it's available.
// The chat works the same without it, on the term lists alone.
//
// firestore.rules independently re-checks crisis/contact-sharing with
// its own small, fixed patterns too, so what this file decides is not
// the final word on whether a write is accepted. But a flag is only
// ever created for what this file's own screening actually found; if
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

// How many messages were on screen last time, so only new ones from the
// other person are read out. null until the chat first loads, so the
// history is never read out all at once (NFR 16).
var announcedCount = null;

function announceNewMessages(messages, myUid) {
  var box = document.getElementById('message-announcer');
  if (!box) return;
  if (announcedCount === null) {
    announcedCount = messages.length;
    return;
  }
  var fresh = messages.slice(announcedCount).filter(function (message) {
    return message.senderId !== myUid;
  });
  announcedCount = messages.length;
  if (fresh.length > 0) box.textContent = 'New message: ' + fresh[fresh.length - 1].text;
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
  // rather than the start of time; otherwise it would briefly jump to
  // the top of the list instead of the bottom.
  messages.sort(function (a, b) {
    var aTime = a.createdAt ? a.createdAt.toMillis() : Date.now();
    var bTime = b.createdAt ? b.createdAt.toMillis() : Date.now();
    return aTime - bTime;
  });
  announceNewMessages(messages, myUid);

  list.innerHTML = '';
  if (messages.length === 0) {
    list.innerHTML = '<li class="message-note" id="no-messages-note"></li>';
    showNoMessagesNote();
    return;
  }

  // Your messages sit on the right, theirs on the left (styles.css).
  // "You:" and "Them:" stay in the page for screen readers, which can't
  // see which side a bubble is on.
  messages.forEach(function (message) {
    var item = document.createElement('li');
    var isMine = message.senderId === myUid;
    item.className = isMine ? 'message-mine' : 'message-theirs';
    item.innerHTML =
      '<span class="visually-hidden">' + (isMine ? 'You' : 'Them') + ': </span>' +
      escapeForDisplay(message.text);
    list.appendChild(item);
  });
}

function listenForMessages(chatId, myUid) {
  firebase
    .firestore()
    .collection('messages')
    .where('chatId', '==', chatId)
    .onSnapshot(
      function (snapshot) {
        renderMessages(snapshot.docs, myUid);
      },
      function (error) {
        // The live updates stopped (no connection, for example). Say so,
        // so nobody waits for a reply that can't arrive (NFR 18).
        showChatMessage('Messages stopped updating. Check your connection and refresh the page.');
        console.error(error);
      }
    );
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

// The note shown when a chat has no messages. Its words depend on whether
// the chat is still open, which may only be known once the chat's status
// has loaded, so listenForChatStatus calls this again.
function showNoMessagesNote() {
  var note = document.getElementById('no-messages-note');
  if (!note) return;
  var ended = currentChat && currentChat.status === 'ended';
  note.textContent = ended ? 'No messages were sent in this chat.' : 'No messages yet. Say hello.';
}

// The line under the heading: where the chat is up to, and its topic in
// the same words as the request form, such as "Topic: Money stress".
function chatStatusText(chat) {
  var status = 'Chat in progress.';
  if (chat.status === 'pending') status = 'Waiting for the listener to accept.';
  if (chat.status === 'ended') status = 'This chat has ended.';
  return chat.topic ? status + ' Topic: ' + topicWord(chat.topic) + '.' : status;
}

// True once a moderator has suspended the signed-in account (BR 7).
// firestore.rules refuses their messages; this only explains why.
var mySuspended = false;

var SUSPENDED_NOTE = "Your account is paused, so you can't send messages for now. " +
  'You can still end this chat, and "Need help now" is always there.';

// Shows or hides the message box, Report and Block, from the chat's
// status and whether this account is suspended.
function updateChatControls() {
  if (!currentChat) return;

  // Before the listener accepts, the message box shows but can't be
  // used. Once the chat has ended it goes away, along with Report
  // and Block, so only the after-chat questions are left. A suspended
  // account keeps Report and Block but can't type.
  var messageForm = document.getElementById('message-form');
  var safetyActions = document.getElementById('safety-actions');
  var notActive = currentChat.status !== 'active';
  var cannotType = notActive || mySuspended;
  if (messageForm) {
    messageForm.hidden = currentChat.status === 'ended';
    messageForm.messageText.disabled = cannotType;
    messageForm.querySelector('button').disabled = cannotType || sendInProgress;
  }
  if (safetyActions) {
    safetyActions.hidden = notActive;
  }
  if (mySuspended && currentChat.status === 'active') {
    showChatMessage(SUSPENDED_NOTE);
  }
}

// Watches the signed-in person's own account, so a suspension during
// an open chat stops the message box straight away (BR 7).
function listenForMyAccount(myUid) {
  firebase
    .firestore()
    .collection('accounts')
    .doc(myUid)
    .onSnapshot(function (docSnap) {
      var wasSuspended = mySuspended;
      mySuspended = docSnap.exists && docSnap.data().status === 'suspended';
      if (wasSuspended && !mySuspended) showChatMessage('');
      updateChatControls();
    }, function (error) {
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
      showChatStatus(chatStatusText(chat));
      showNoMessagesNote();
      updateChatControls();
    }, function (error) {
      showChatStatus('This chat stopped updating. Check your connection and refresh the page.');
      console.error(error);
    });
}

// Who's on the other side of this chat from the signed-in user?
function otherParticipant(chat, myUid) {
  return chat.userId === myUid ? chat.listenerId : chat.userId;
}

// ---- Anonymised statistics (FR 7.3)
//
// The admin's stats page counts flags and chats without reading either.
// So, after a flag, report or ended chat is safely saved, a small copy
// with no names, IDs or text is written for it. These copies are written
// AFTER the real write and never wait on it: if one fails, the message,
// flag or chat is already saved, and only a count is missed. That way a
// statistic can never get in the way of a safety action.

// One count for each flag or report: only its kind and when. The copy
// uses the same document ID, so firestore.rules can check it matches a
// real flag or report by this sender, and it can only be counted once.
function recordSafetyTally(id, kind) {
  firebase
    .firestore()
    .collection('safetyTally')
    .doc(id)
    .set({ kind: kind, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
    .catch(function (error) {
      console.error('Could not record a safety count', error);
    });
}

// The parts of an ended chat the pilot measures: its topic and the moods
// before and after (FR 3.2). No user, listener or message. firestore.rules
// checks every value matches the chat. Resolves either way.
function recordChatStats(chatId, chat, moodAfter) {
  return firebase
    .firestore()
    .collection('chatStats')
    .doc(chatId)
    .set({
      topic: chat.topic,
      moodBefore: chat.moodBefore,
      moodAfter: moodAfter,
      recordedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .catch(function (error) {
      console.error('Could not record chat statistics', error);
    });
}

// Adds the answers to "Was this chat helpful?" and "Would you use Spill
// again?" to the chat's statistics, once they are saved on the chat.
// Resolves either way.
function recordChatAnswers(chatId, rating, useAgain) {
  return firebase
    .firestore()
    .collection('chatStats')
    .doc(chatId)
    .update({ rating: rating || null, useAgain: useAgain || null })
    .catch(function (error) {
      console.error('Could not record chat answers', error);
    });
}

// FR 6.5: either participant can report the chat with a reason. Writing
// the chatFlagged marker in the same batch is what lets a moderator
// later open a case on it (BR 3); a report on its own doesn't give
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

  return batch.commit().then(function () {
    recordSafetyTally(reportRef.id, 'report');
  });
}

// FR 6.6, BR 5: either side can block the other at any time, no reason
// needed, and isn't matched with them again (see isEligibleListener in
// firestore.rules). Blocking also ends the current chat; there's no
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
// that describes how the chat felt to them; the chat is already ended
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
// and the mood check-in is already stored; rating can be skipped
// without skipping the (required) mood check-in that came before it.
// useAgain answers the pilot goal "would use Spill again" (SRS section 1):
// 'yes', 'no' or 'not-sure'. It is only saved if the person answered it,
// and firestore.rules lets only the user in the chat set it.
function saveRating(chatId, rating, ratingComment, useAgain) {
  var answers = { rating: rating, ratingComment: ratingComment };
  if (useAgain) answers.useAgain = useAgain;
  return firebase.firestore().collection('chats').doc(chatId).update(answers);
}

function markChatFlagged(batch, chatId) {
  var ref = firebase.firestore().collection('chatFlagged').doc(chatId);
  batch.set(ref, { chatId: chatId }, { merge: true });
}

// NFR 10: at most one message every 2 seconds. firestore.rules is what
// enforces it; this only lets the page say so without trying.
var MIN_GAP_MS = 2000;
var lastSentAtMs = 0; // when the last message was saved
var sendInProgress = false;

// Resolves once 2 seconds have passed since the last message was saved.
function waitForSendGap() {
  var wait = MIN_GAP_MS - (Date.now() - lastSentAtMs);
  if (wait <= 0) return Promise.resolve();
  showChatMessage('Sending...');
  return new Promise(function (resolve) {
    setTimeout(function () {
      showChatMessage('');
      resolve();
    }, wait);
  });
}

// Every message goes in the same batch as the sender's sendTimes record,
// set to the moment it's saved. The rules refuse a message without it,
// and refuse the record if the last message was under 2 seconds ago.
function addSendTime(batch, uid) {
  var ref = firebase.firestore().collection('sendTimes').doc(uid);
  batch.set(ref, { lastSentAt: firebase.firestore.FieldValue.serverTimestamp() });
}

// FR 6.1: a plain, unflagged message: the happy path for almost every
// message sent. Resolves to the new message's id.
function sendPlainMessage(chatId, user, text) {
  var db = firebase.firestore();
  var messageRef = db.collection('messages').doc();
  var batch = db.batch();

  batch.set(messageRef, {
    chatId: chatId,
    senderId: user.uid,
    text: text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  addSendTime(batch, user.uid);

  return batch.commit().then(function () {
    return messageRef.id;
  });
}

// FR 6.2: the message is still delivered. The message and its
// high-priority flag are written in one atomic batch; firestore.rules
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
  addSendTime(batch, user.uid);

  return batch.commit().then(function () {
    recordSafetyTally(flagRef.id, 'crisis');
  });
}

// FR 6.3: contact-sharing is never delivered. A separate "blocked
// attempt" flag is written instead, since rules can only allow or deny a
// write, not create data of their own. A listener account sending this
// is a bigger trust problem than a user doing it, so it's flagged at
// higher severity. If the blocked text also had crisis wording, a
// crisis flag is raised too; the sender still gets help even though
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

  var crisisFlagRef = null;
  if (alsoHasCrisis) {
    crisisFlagRef = db.collection('flags').doc();
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

  return batch.commit().then(function () {
    recordSafetyTally(contactFlagRef.id, 'contact-sharing');
    if (crisisFlagRef) recordSafetyTally(crisisFlagRef.id, 'crisis');
  });
}

// FR 6.4: abusive language is flagged, but still delivered; the
// recipient can already end the chat at any time if they need to.
// Resolves to the new message's id.
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
  addSendTime(batch, user.uid);

  return batch.commit().then(function () {
    recordSafetyTally(flagRef.id, 'abusive-language');
    return messageRef.id;
  });
}

// How long to wait for the model check's answer before giving up on it.
// An answer usually takes a few seconds.
var MODEL_WAIT_MS = 20000;

// Asks the model check (model-check.js) for a second opinion on a
// message. Always answers within MODEL_WAIT_MS: with the model's levels,
// or with null if it isn't loaded, fails or is too slow. It never
// rejects.
function askModel(text) {
  if (typeof window.checkMessageWithModel !== 'function') {
    return Promise.resolve(null);
  }

  var tooSlow = new Promise(function (resolve) {
    setTimeout(function () {
      resolve(null);
    }, MODEL_WAIT_MS);
  });
  var answer = Promise.resolve()
    .then(function () {
      return window.checkMessageWithModel(text);
    })
    .catch(function (error) {
      console.error(error);
      return null;
    });

  return Promise.race([answer, tooSlow]);
}

// The model check's flag for a message that has already been sent: the
// flag and the chatFlagged marker in one batch. Same flag types and
// severities as the term lists use (FR 6.2, FR 6.4).
function sendModelFlag(chatId, user, messageId, finding) {
  var db = firebase.firestore();
  var batch = db.batch();
  var flagRef = db.collection('flags').doc();
  var kind = finding === 'crisis' ? 'crisis' : 'abusive-language';

  batch.set(flagRef, {
    type: kind,
    chatId: chatId,
    senderId: user.uid,
    messageId: messageId,
    severity: finding === 'crisis' ? 3 : 1,
    status: 'open',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  markChatFlagged(batch, chatId);

  return batch.commit().then(function () {
    recordSafetyTally(flagRef.id, kind);
  });
}

// Runs after a message has been sent. The model check never holds a
// message back, because its answer can take several seconds. It can
// only add a crisis or abuse flag to a message that is already
// delivered (see modelFinding in screening.js). For crisis, the sender
// is shown the crisis card then too. Nothing here can undo or fail the
// message itself.
function checkSentMessageWithModel(chatId, user, text, messageId, screened) {
  // Only for a sender, user or listener, who pressed "Agree" on the
  // Safety check notice (model-check-settings.js). Each side answers
  // for their own messages. For anyone else the message is never
  // sent to the model, and the term lists alone stand.
  var choice = readModelCheckChoice(window.localStorage, user.uid);
  if (!canUseModelCheck(isModelCheckOnHere(), choice)) return;

  askModel(text)
    .then(function (levels) {
      var finding = modelFinding(screened, levels);
      if (!finding) return null;

      if (finding === 'crisis') showCrisisCard();
      return sendModelFlag(chatId, user, messageId, finding);
    })
    .catch(function (error) {
      console.error(error);
    });
}

// Empties the message box once a message is sent, but only if it still
// holds that message: anything typed since then is kept.
function clearSentText(form, text) {
  if (form.messageText.value.trim() === text) form.messageText.value = '';
}

// Screens the message, then sends it the right way (FR 6.1-6.4).
//
// The term lists decide how the message is sent. Contact details are
// blocked and crisis wording is flagged at once, and neither is passed
// on to the model. Any other message is sent straight away and then
// checked by the model as well. Always resolves, once the message is
// saved or the error is shown.
function screenAndSendMessage(chatId, user, text, isListener, form) {
  var screened = screenMessage(text, extraScreeningTerms);

  if (screened.hasContactSharing) {
    return sendBlockedAttempt(chatId, user, text, isListener, screened.hasCrisisLanguage)
      .then(function () {
        clearSentText(form, text);
        showChatMessage("That message wasn't sent. Don't share phone numbers, emails, links or other ways to contact you here. Everything stays on Spill.");
        if (screened.hasCrisisLanguage) showCrisisCard();
      })
      .catch(function (error) {
        showChatMessage('Could not send that message. Please try again.');
        console.error(error);
      });
  }

  if (screened.hasCrisisLanguage) {
    return sendCrisisMessage(chatId, user, text)
      .then(function () {
        lastSentAtMs = Date.now();
        clearSentText(form, text);
        showChatMessage('');
        showCrisisCard();
      })
      .catch(function (error) {
        // Even if saving failed, the sender still sees where to get help.
        showChatMessage('Could not send that message. Please try again.');
        showCrisisCard();
        console.error(error);
      });
  }

  if (screened.hasAbusiveLanguage) {
    return sendAbuseFlaggedMessage(chatId, user, text)
      .then(function (messageId) {
        lastSentAtMs = Date.now();
        clearSentText(form, text);
        showChatMessage('');
        checkSentMessageWithModel(chatId, user, text, messageId, screened);
      })
      .catch(function (error) {
        showChatMessage('Could not send that message. Please try again.');
        console.error(error);
      });
  }

  // Looks clean to this file's screening, so it's sent as a plain
  // message. If the write is refused anyway (firestore.rules has its
  // own independent, fixed crisis/contact-sharing check), that's not
  // retried as a crisis or blocked-attempt flag; this file's own
  // screening didn't find crisis wording here, so raising a crisis flag
  // would be a guess, not a fact. Just show the error.
  return sendPlainMessage(chatId, user, text)
    .then(function (messageId) {
      lastSentAtMs = Date.now();
      clearSentText(form, text);
      showChatMessage('');
      checkSentMessageWithModel(chatId, user, text, messageId, screened);
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
    listenForMyAccount(user.uid);
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

      // One message at a time: the button is off until this one is saved.
      // Under 2 seconds since the last one was saved (NFR 10), it waits
      // out the rest first. Nothing is lost, crisis wording included.
      if (sendInProgress) return;
      sendInProgress = true;
      form.querySelector('button').disabled = true;

      waitForSendGap()
        .then(function () {
          return screenAndSendMessage(chatId, user, text, isListener, form);
        })
        .then(function () {
          sendInProgress = false;
          updateChatControls();
        });
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
          showChatMessage('Thanks. A moderator will review this.');
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
      // that, not part of the same form; it can be skipped on its own
      // without skipping the mood check-in.
      endChatButton.hidden = true;
      if (moodAfterForm) moodAfterForm.hidden = false;
    });
  }

  if (moodAfterForm) {
    moodAfterForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var moodAfter = parseInt(moodAfterForm.moodAfter.value, 10);
      var chatBefore = currentChat;

      endChat(chatId, { moodAfter: moodAfter })
        .then(function () {
          // The chat is ended and saved; now its statistics. Waiting here
          // means the answers below can add to them. It never fails.
          return recordChatStats(chatId, chatBefore, moodAfter);
        })
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
      var useAgainInput = ratingForm.querySelector('input[name="useAgain"]:checked');
      var useAgain = useAgainInput ? useAgainInput.value : null;

      saveRating(chatId, rating, ratingComment, useAgain)
        .then(function () {
          // The comment is never copied: it is free text.
          return recordChatAnswers(chatId, rating, useAgain);
        })
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
