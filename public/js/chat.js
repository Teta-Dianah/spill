// The chat screen: real-time messages via Firestore listeners, no
// polling (FR 4.3, FR 4.7, NFR 2). Screening (FR 6.1-6.3) is not built
// yet — that's Sprint 3.

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

  messages.sort(function (a, b) {
    var aTime = a.createdAt ? a.createdAt.toMillis() : 0;
    var bTime = b.createdAt ? b.createdAt.toMillis() : 0;
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

function listenForChatStatus(chatId) {
  firebase
    .firestore()
    .collection('chats')
    .doc(chatId)
    .onSnapshot(function (docSnap) {
      if (!docSnap.exists) return;

      var chat = docSnap.data();
      var topicLabel = chat.topic ? ' — ' + chat.topic : '';
      showChatStatus(chat.status === 'ended' ? 'This chat has ended.' + topicLabel : 'Chat in progress' + topicLabel);

      var form = document.getElementById('message-form');
      if (form) {
        var disabled = chat.status === 'ended';
        form.messageText.disabled = disabled;
        form.querySelector('button').disabled = disabled;
      }
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

      firebase
        .firestore()
        .collection('messages')
        .add({
          chatId: chatId,
          senderId: user.uid,
          text: text,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .then(function () {
          form.reset();
        })
        .catch(function (error) {
          showChatMessage('Could not send that message. Please try again.');
          console.error(error);
        });
    });
  }
});
