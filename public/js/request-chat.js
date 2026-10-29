// Wires up the chat request form: picks a topic, captures the
// before-chat mood, and matches with a listener who then has to accept
// (FR 3.2, FR 4.1, FR 4.2, FR 5.5). Needs listeners.js loaded first.

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

      showRequestMessage('Waiting for a listener to accept your request...');
    });
}

function requestChat(user, ageBand, topic, moodBefore, declinedListenerIds) {
  findEligibleListener(ageBand, declinedListenerIds, function (listenerId) {
    if (!listenerId) {
      showRequestMessage('No listener is available right now. Please try again soon, or see the resources below.');
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
        showRequestMessage('Waiting for a listener to accept your request...');
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
