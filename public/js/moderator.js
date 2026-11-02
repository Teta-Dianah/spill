// The moderator queue, case access and the audit log (FR 7.1, FR 7.3,
// FR 6.9, BR 3). Needs firebase-init.js loaded first.

// FR 7.1: flags and reports share one queue, ordered by severity
// (highest first) and then age (oldest first) within the same
// severity. Firestore can't query two collections at once, so this
// loads both and merges client-side.
function loadQueueItems(onLoaded) {
  var db = firebase.firestore();

  Promise.all([
    db.collection('flags').where('status', '==', 'open').get(),
    db.collection('reports').where('status', '==', 'open').get(),
  ]).then(function (results) {
    var items = [];

    results[0].forEach(function (docSnap) {
      var data = docSnap.data();
      data.id = docSnap.id;
      data.itemType = 'flag';
      items.push(data);
    });
    results[1].forEach(function (docSnap) {
      var data = docSnap.data();
      data.id = docSnap.id;
      data.itemType = 'report';
      items.push(data);
    });

    items.sort(function (a, b) {
      if (b.severity !== a.severity) return b.severity - a.severity;
      var aTime = a.createdAt ? a.createdAt.toMillis() : 0;
      var bTime = b.createdAt ? b.createdAt.toMillis() : 0;
      return aTime - bTime;
    });

    onLoaded(items);
  });
}

function loadQueueItem(itemType, itemId, onLoaded) {
  firebase
    .firestore()
    .collection(itemType === 'flag' ? 'flags' : 'reports')
    .doc(itemId)
    .get()
    .then(function (docSnap) {
      if (!docSnap.exists) {
        onLoaded(null);
        return;
      }
      var data = docSnap.data();
      data.id = docSnap.id;
      data.itemType = itemType;
      onLoaded(data);
    });
}

// BR 3: a moderator can only see chat content after deliberately
// opening a case, and that access is logged (FR 6.9). If a case is
// already open on this chat (another item pointed at the same one),
// this just logs the new access without touching chatCases again.
function openCase(chatId, moderatorUid, itemType, itemId) {
  var db = firebase.firestore();
  var caseRef = db.collection('chatCases').doc(chatId);

  return caseRef.get().then(function (caseDoc) {
    if (caseDoc.exists) {
      return db.collection('auditLog').add({
        actorId: moderatorUid,
        action: 'open_case',
        chatId: chatId,
        itemType: itemType,
        itemId: itemId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    var batch = db.batch();
    batch.set(caseRef, {
      chatId: chatId,
      openedBy: moderatorUid,
      openedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    var auditRef = db.collection('auditLog').doc();
    batch.set(auditRef, {
      actorId: moderatorUid,
      action: 'open_case',
      chatId: chatId,
      itemType: itemType,
      itemId: itemId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return batch.commit();
  });
}

function loadChatMessages(chatId, onLoaded) {
  firebase
    .firestore()
    .collection('messages')
    .where('chatId', '==', chatId)
    .get()
    .then(function (snapshot) {
      var messages = [];
      snapshot.forEach(function (docSnap) {
        messages.push(docSnap.data());
      });
      messages.sort(function (a, b) {
        var aTime = a.createdAt ? a.createdAt.toMillis() : 0;
        var bTime = b.createdAt ? b.createdAt.toMillis() : 0;
        return aTime - bTime;
      });
      onLoaded(messages);
    });
}

// FR 7.3: dismiss, warn, suspend, reinstate or escalate a queue item,
// always with a reason, always logged (FR 6.9). Suspend and reinstate
// target the subject of the flag/report itself — the flag's sender, or
// the person a report names — never anyone else. "Escalate" only marks
// the item itself for closer review; there's no second queue tier to
// move it to yet.
//
// The item update and the account update (when there is one) both
// carry the audit entry's own id (auditLogId / lastAuditLogId) and are
// committed in the same batch as that entry. firestore.rules checks
// this pairing — an action with no matching audit entry, or an account
// update that doesn't trace back to the actual subject of this exact
// flag/report, is refused.
function applyModeratorAction(item, action, reason, moderatorUid) {
  var db = firebase.firestore();
  var batch = db.batch();
  var itemRef = db.collection(item.itemType === 'flag' ? 'flags' : 'reports').doc(item.id);
  var auditRef = db.collection('auditLog').doc();

  batch.update(itemRef, {
    status: action === 'escalate' ? 'escalated' : 'resolved',
    action: action,
    reason: reason,
    auditLogId: auditRef.id,
  });

  var targetUid = item.itemType === 'flag' ? item.senderId : item.reportedId;
  if ((action === 'suspend' || action === 'reinstate') && targetUid) {
    batch.update(db.collection('accounts').doc(targetUid), {
      status: action === 'suspend' ? 'suspended' : 'active',
      lastAuditLogId: auditRef.id,
    });
  }

  batch.set(auditRef, {
    actorId: moderatorUid,
    action: action,
    chatId: item.chatId,
    itemType: item.itemType,
    itemId: item.id,
    targetUid: targetUid || null,
    reason: reason,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  return batch.commit();
}

window.loadQueueItems = loadQueueItems;
window.loadQueueItem = loadQueueItem;
window.openCase = openCase;
window.loadChatMessages = loadChatMessages;
window.applyModeratorAction = applyModeratorAction;
