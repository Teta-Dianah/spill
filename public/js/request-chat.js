// Wires up the chat request form: picks a topic, captures the
// before-chat mood, and matches with a listener who then has to accept
// (FR 3.2, FR 4.1, FR 4.2, FR 5.5). Needs listeners.js loaded first.
//
// Whether nobody's free right now, or the listener who was found
// declines, the user sees the exact same wait status (self-help
// resources are always on this page below the form either way) and the
// request is retried automatically — neither path is a dead end.

var RETRY_DELAY_MS = 15000;
var WAITING_MESSAGE = 'Waiting for a listener to accept your request...';

function showRequestMessage(text) {
  var box = document.getElementById('request-message');
  if (box) box.textContent = text;
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
        window.location.href = 'chat.html?chatId=' + chatId;
        return;
      }

      if (chat.status === 'declined') {
        unsubscribe();
        declinedListenerIds.push(chat.listenerId);
        requestChat(user, ageBand, topic, moodBefore, declinedListenerIds);
        return;
      }

      showRequestMessage(WAITING_MESSAGE);
    });
}

// Whether this is the very first attempt or a retry after a decline,
// "nobody's free right now" gets exactly the same wait status as
// "someone's been asked and we're waiting for them to accept" — the
// user has no reason to see a different, more alarming message just
// because the retry mechanics underneath happen to differ. Either way,
// this quietly tries again shortly rather than leaving the request
// stuck (FR 4.1, FR 5.5).
function requestChat(user, ageBand, topic, moodBefore, declinedListenerIds) {
  findEligibleListener(ageBand, declinedListenerIds, function (listenerId) {
    if (!listenerId) {
      showRequestMessage(WAITING_MESSAGE);
      setTimeout(function () {
        requestChat(user, ageBand, topic, moodBefore, declinedListenerIds);
      }, RETRY_DELAY_MS);
      return;
    }

    firebase
      .firestore()
      .collection('chats')
      .add({
        userId: user.uid,
        listenerId: listenerId,
        topic: topic,
        status: 'pending',
        moodBefore: moodBefore,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .then(function (chatRef) {
        showRequestMessage(WAITING_MESSAGE);
        watchPendingChat(chatRef.id, user, ageBand, topic, moodBefore, declinedListenerIds);
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
    }
  });

  var form = document.getElementById('request-chat-form');
  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var user = firebase.auth().currentUser;
    if (!user) return;

    var topic = form.topic.value;
    var moodBefore = parseInt(form.moodBefore.value, 10);

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
});
