// Removes a person's own chats once they are more than 90 days old
// (NFR 13). The free Firebase plan can't run a clean-up on a timer, so
// it runs here instead, each time someone opens their dashboard. A chat
// that is still going is never touched, and the rules keep any chat a
// flag or report was raised in, since a moderator may still need it.
//
// It runs quietly in the background: if anything fails, nothing is
// shown and it simply tries again next time.

var CHAT_KEEP_DAYS = 90;
var DAY_MS = 24 * 60 * 60 * 1000;

// True for a chat that is over and was started more than 90 days ago.
// chat.createdAtMs is the start time in milliseconds.
function isOldFinishedChat(chat, nowMs) {
  var finished = ['ended', 'declined', 'cancelled'].indexOf(chat.status) !== -1;
  return finished && !!chat.createdAtMs && nowMs - chat.createdAtMs > CHAT_KEEP_DAYS * DAY_MS;
}

// Deletes one chat: its messages first (the rules check the chat while
// deleting them), up to 400 at a time, then the chat itself.
function deleteChatAndMessages(chatId) {
  var db = firebase.firestore();
  return db
    .collection('messages')
    .where('chatId', '==', chatId)
    .limit(400)
    .get()
    .then(function (snapshot) {
      if (snapshot.empty) {
        return db.collection('chats').doc(chatId).delete();
      }
      var batch = db.batch();
      snapshot.forEach(function (docSnap) {
        batch.delete(docSnap.ref);
      });
      return batch.commit().then(function () {
        return deleteChatAndMessages(chatId);
      });
    });
}

// role is 'userId' on the user's dashboard and 'listenerId' on the
// listener's. One chat after another, so a refused one (kept for a
// safety case) doesn't stop the rest.
function removeOldChats(uid, role) {
  var now = Date.now();
  return firebase
    .firestore()
    .collection('chats')
    .where(role, '==', uid)
    .get()
    .then(function (snapshot) {
      var oldIds = [];
      snapshot.forEach(function (docSnap) {
        var data = docSnap.data();
        var chat = { status: data.status, createdAtMs: data.createdAt ? data.createdAt.toMillis() : 0 };
        if (isOldFinishedChat(chat, now)) oldIds.push(docSnap.id);
      });

      return oldIds.reduce(function (done, chatId) {
        return done.then(function () {
          return deleteChatAndMessages(chatId).catch(function () {
            // Kept by the rules (a flag or report was raised), or already
            // removed by the other person. Either way, move on.
          });
        });
      }, Promise.resolve());
    })
    .catch(function (error) {
      console.error(error);
    });
}

if (typeof module !== 'undefined') {
  module.exports = { isOldFinishedChat, CHAT_KEEP_DAYS };
} else {
  // For dashboard.js and listener-dashboard.js, which load after this.
  window.removeOldChats = removeOldChats;
}
