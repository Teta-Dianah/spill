// Wires up the chat request form: picks a topic, captures the
// before-chat mood, and matches with a listener (FR 3.2, FR 4.1, FR 4.2).
// Needs listeners.js loaded first.

function showRequestMessage(text) {
  var box = document.getElementById('request-message');
  if (box) box.textContent = text;
}

function startChat(user, ageBand, topic, moodBefore) {
  findEligibleListener(ageBand, function (listenerId) {
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
        status: 'active',
        moodBefore: moodBefore,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .then(function (chatRef) {
        window.location.href = 'chat.html?chatId=' + chatRef.id;
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
        startChat(user, ageBand, topic, moodBefore);
      });
  });
});
