// Wires up the chat request form: picks a topic, captures the
// before-chat mood, and matches with a listener who then has to accept
// (FR 3.2, FR 4.1, FR 4.2, FR 5.5). Needs listeners.js loaded first.
//
// Whether nobody's free right now, or the listener who was found
// declines, the user sees the exact same wait status (self-help
// resources are always on this page below the form either way) and the
// request is retried automatically — neither path is a dead end. The
// retry gives up after MAX_WAIT_MS of nobody being free, stops
// scheduling itself the moment the user leaves this page, and
// firestore.rules refuses a second pending chat while one is already
// claimed (FR 4.1) — see the pendingChats collection there.
//
// The pendingChats marker is released whenever this search genuinely
// ends: matched (watchPendingChat's active branch), declined (released
// and immediately re-claimed for the retry), given up on after
// MAX_WAIT_MS, cancelled by the user, or found stale on a later page
// load (clearStalePendingSlot) — a user is never permanently stuck
// holding a slot they can't start a fresh request with.

var RETRY_DELAY_MS = 15000;
var MAX_WAIT_MS = 10 * 60 * 1000;
var WAITING_MESSAGE = 'Waiting for a listener to accept your request...';

var stopped = false;
window.addEventListener('beforeunload', function () {
  stopped = true;
});

// The chat (if any) currently being watched while waiting for a
// listener to respond — tracked so cancelRequest() can stop watching
// it and mark it cancelled, not just release the marker.
var currentWatch = null;

function showRequestMessage(text) {
  var box = document.getElementById('request-message');
  if (box) box.textContent = text;
}

function showCancelButton(visible) {
  var button = document.getElementById('cancel-request-button');
  if (button) button.hidden = !visible;
}

function pendingChatRef(uid) {
  return firebase.firestore().collection('pendingChats').doc(uid);
}

function releasePendingSlot(uid) {
  return pendingChatRef(uid).delete().catch(function (error) {
    console.error(error);
  });
}

// FR 4.1: lets the user give up on their own terms rather than only by
// waiting out MAX_WAIT_MS. If a specific chat is currently pending, it's
// marked "cancelled" (not just abandoned) so it drops out of that
// listener's incoming-requests list on their dashboard instead of
// sitting there forever waiting on someone who's no longer there.
function cancelRequest(user) {
  stopped = true;
  showCancelButton(false);

  var chatCleanup = Promise.resolve();
  if (currentWatch) {
    currentWatch.unsubscribe();
    chatCleanup = firebase
      .firestore()
      .collection('chats')
      .doc(currentWatch.chatId)
      .update({ status: 'cancelled' })
      .catch(function (error) {
        console.error(error);
      });
    currentWatch = null;
  }

  chatCleanup
    .then(function () {
      return releasePendingSlot(user.uid);
    })
    .then(function () {
      showRequestMessage('Request cancelled.');
    });
}

// A marker left behind by an abandoned session (closed tab, browser
// crash) shouldn't block a fresh request forever — once it's old
// enough that we'd have given up retrying anyway, it no longer counts.
function clearStalePendingSlot(uid, onDone) {
  pendingChatRef(uid)
    .get()
    .then(function (docSnap) {
      if (!docSnap.exists) {
        onDone();
        return;
      }
      var createdAt = docSnap.data().createdAt;
      if (createdAt && Date.now() - createdAt.toMillis() >= MAX_WAIT_MS) {
        releasePendingSlot(uid).then(onDone);
        return;
      }
      onDone();
    })
    .catch(function () {
      onDone();
    });
}

// Watches a pending chat and reacts once the listener responds:
// accepted -> go to the chat; declined -> try the next eligible listener,
// excluding everyone who has already said no this session (FR 5.5).
function watchPendingChat(chatId, user, ageBand, topic, moodBefore, declinedListenerIds) {
  var unsubscribe = firebase
    .firestore()
    .collection('chats')
    .doc(chatId)
    .onSnapshot(function (docSnap) {
      if (!docSnap.exists) return;
      var chat = docSnap.data();

      if (chat.status === 'active') {
        unsubscribe();
        currentWatch = null;
        releasePendingSlot(user.uid).then(function () {
          window.location.href = 'chat.html?chatId=' + chatId;
        });
        return;
      }

      if (chat.status === 'declined') {
        unsubscribe();
        currentWatch = null;
        declinedListenerIds.push(chat.listenerId);
        releasePendingSlot(user.uid).then(function () {
          requestChat(user, ageBand, topic, moodBefore, declinedListenerIds);
        });
        return;
      }

      showRequestMessage(WAITING_MESSAGE);
    });

  currentWatch = { unsubscribe: unsubscribe, chatId: chatId };
}

// FR 4.1: the chat and the pendingChats claim naming it are written in
// one atomic batch — firestore.rules refuses the chat unless the claim
// names this exact chat, and refuses a second claim while one already
// stands, so a user can never end up with two pending chats at once.
function claimAndCreateChat(user, listenerId, topic, moodBefore) {
  var db = firebase.firestore();
  var chatRef = db.collection('chats').doc();
  var batch = db.batch();

  batch.set(pendingChatRef(user.uid), {
    chatId: chatRef.id,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  batch.set(chatRef, {
    userId: user.uid,
    listenerId: listenerId,
    topic: topic,
    status: 'pending',
    moodBefore: moodBefore,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  return batch.commit().then(function () {
    return chatRef.id;
  });
}

// Whether this is the very first attempt or a retry after a decline,
// "nobody's free right now" gets exactly the same wait status as
// "someone's been asked and we're waiting for them to accept" — the
// user has no reason to see a different, more alarming message just
// because the retry mechanics underneath happen to differ. Either way,
// this quietly tries again shortly rather than leaving the request
// stuck (FR 4.1, FR 5.5) — but not forever: searchStartedAt (set once,
// on the first call of each new search) caps how long it keeps trying.
function requestChat(user, ageBand, topic, moodBefore, declinedListenerIds, searchStartedAt) {
  searchStartedAt = searchStartedAt || Date.now();

  if (stopped) return;

  findEligibleListener(ageBand, declinedListenerIds, function (listenerId) {
    if (stopped) return;

    if (!listenerId) {
      if (Date.now() - searchStartedAt >= MAX_WAIT_MS) {
        showRequestMessage("We couldn't find a listener this time. Please try again in a little while, or see the resources below.");
        showCancelButton(false);
        releasePendingSlot(user.uid);
        return;
      }

      showRequestMessage(WAITING_MESSAGE);
      setTimeout(function () {
        if (stopped) return;
        requestChat(user, ageBand, topic, moodBefore, declinedListenerIds, searchStartedAt);
      }, RETRY_DELAY_MS);
      return;
    }

    claimAndCreateChat(user, listenerId, topic, moodBefore)
      .then(function (chatId) {
        showRequestMessage(WAITING_MESSAGE);
        watchPendingChat(chatId, user, ageBand, topic, moodBefore, declinedListenerIds);
      })
      .catch(function (error) {
        showRequestMessage('Could not start a chat right now. Please try again.');
        console.error(error);
      });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
      return;
    }

    clearStalePendingSlot(user.uid, function () {});
  });

  var form = document.getElementById('request-chat-form');
  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var user = firebase.auth().currentUser;
    if (!user) return;

    var topic = form.topic.value;
    var moodBefore = parseInt(form.moodBefore.value, 10);

    showCancelButton(true);

    firebase
      .firestore()
      .collection('accounts')
      .doc(user.uid)
      .get()
      .then(function (accountDoc) {
        var ageBand = accountDoc.exists ? accountDoc.data().ageBand : null;
        requestChat(user, ageBand, topic, moodBefore, []);
      });
  });

  var cancelButton = document.getElementById('cancel-request-button');
  if (cancelButton) {
    cancelButton.addEventListener('click', function () {
      var user = firebase.auth().currentUser;
      if (!user) return;
      cancelRequest(user);
    });
  }
});
