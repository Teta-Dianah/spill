// Listener applications, approval and availability (FR 5).
// Needs firebase-init.js loaded first.

// Sends a listener application (FR 5.1). Two documents are written
// together, in one batch:
//   listenerApplications/{uid}  the answers. Private: only the applicant
//                               and an admin can read them.
//   listeners/{uid}             the small record used for matching, which
//                               any signed-in user can read. It holds no
//                               answers.
// application is what checkListenerApplication() returned, with the
// reference code added.
function applyAsListener(uid, application) {
  var db = firebase.firestore();
  var now = firebase.firestore.FieldValue.serverTimestamp();
  var batch = db.batch();

  var privateAnswers = {};
  Object.keys(application).forEach(function (key) {
    privateAnswers[key] = application[key];
  });
  privateAnswers.createdAt = now;

  batch.set(db.collection('listenerApplications').doc(uid), privateAnswers);
  batch.set(db.collection('listeners').doc(uid), {
    status: 'pending',
    clearedForMinors: false,
    available: false,
    trainingComplete: false,
    appliedAt: now,
  });
  return batch.commit();
}

// The private application. onLoaded gets null if there isn't one.
function getListenerApplication(uid, onLoaded) {
  firebase
    .firestore()
    .collection('listenerApplications')
    .doc(uid)
    .get()
    .then(function (docSnap) {
      onLoaded(docSnap.exists ? docSnap.data() : null);
    })
    .catch(function () {
      onLoaded(null);
    });
}

// Adds the auditLog entry every admin step on a listener must come with
// (FR 6.9). firestore.rules refuses the step without it. Returns the new
// entry's id.
function addListenerAuditEntry(batch, adminUid, listenerUid, action, details) {
  var db = firebase.firestore();
  var auditRef = db.collection('auditLog').doc();
  var entry = {
    actorId: adminUid,
    action: action,
    itemType: 'listener',
    itemId: listenerUid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  Object.keys(details || {}).forEach(function (key) {
    entry[key] = details[key];
  });
  batch.set(auditRef, entry);
  return auditRef.id;
}

// Records which in-person checks an admin has confirmed (FR 5.2). checks
// is like { identity: true, references: false, ... }. Only the fact that
// a check was done is saved, never a document.
function saveListenerChecks(uid, checks, adminUid) {
  var db = firebase.firestore();
  var batch = db.batch();
  var auditId = addListenerAuditEntry(batch, adminUid, uid, 'update_listener_checks', { checks: checks });
  batch.update(db.collection('listenerApplications').doc(uid), {
    checks: checks,
    reviewedBy: adminUid,
    lastAuditLogId: auditId,
  });
  return batch.commit();
}

function getListener(uid, onLoaded) {
  firebase
    .firestore()
    .collection('listeners')
    .doc(uid)
    .get()
    .then(function (docSnap) {
      onLoaded(docSnap.exists ? docSnap.data() : null);
    });
}

// FR 5.2: admin-only in practice — firestore.rules is what actually
// enforces that, this is just the data call.
function loadAllListeners(onLoaded) {
  firebase
    .firestore()
    .collection('listeners')
    .get()
    .then(function (snapshot) {
      var listeners = [];
      snapshot.forEach(function (docSnap) {
        var data = docSnap.data();
        data.uid = docSnap.id;
        listeners.push(data);
      });
      onLoaded(listeners);
    });
}

// Approves a listener. firestore.rules only allows it once all four
// in-person checks are ticked on their application.
function approveListener(uid, clearedForMinors, adminUid) {
  var db = firebase.firestore();
  var batch = db.batch();
  var auditId = addListenerAuditEntry(batch, adminUid, uid, 'approve_listener', {
    clearedForMinors: !!clearedForMinors,
  });
  batch.update(db.collection('listeners').doc(uid), {
    status: 'approved',
    clearedForMinors: !!clearedForMinors,
    lastAuditLogId: auditId,
  });
  return batch.commit();
}

// Rejects an application. A reason is required and is saved on the
// private application, with the same audit entry.
function rejectListener(uid, reason, adminUid) {
  var db = firebase.firestore();
  var batch = db.batch();
  var auditId = addListenerAuditEntry(batch, adminUid, uid, 'reject_listener', { reason: reason });
  batch.update(db.collection('listenerApplications').doc(uid), {
    rejectionReason: reason,
    reviewedBy: adminUid,
    lastAuditLogId: auditId,
  });
  batch.update(db.collection('listeners').doc(uid), {
    status: 'rejected',
    lastAuditLogId: auditId,
  });
  return batch.commit();
}

function setListenerAvailability(uid, available) {
  return firebase.firestore().collection('listeners').doc(uid).update({
    available: available,
  });
}

function setTrainingComplete(uid) {
  return firebase.firestore().collection('listeners').doc(uid).update({
    trainingComplete: true,
  });
}

// Finds an approved, available listener who can take this user, following
// BR 1 (16-17 only matched with listeners cleared for minors). Picks the
// first eligible one found — simple, no ranking or load-balancing.
// excludeIds skips listeners who already declined this user's request in
// this session (FR 5.5), so retrying doesn't just ask the same person again.
function findEligibleListener(ageBand, excludeIds, onFound) {
  firebase
    .firestore()
    .collection('listeners')
    .where('status', '==', 'approved')
    .where('available', '==', true)
    .get()
    .then(function (snapshot) {
      var match = null;
      snapshot.forEach(function (docSnap) {
        if (match) return;
        if (excludeIds.indexOf(docSnap.id) !== -1) return;
        var listener = docSnap.data();
        if (ageBand === '16-17' && !listener.clearedForMinors) return;
        match = docSnap.id;
      });
      onFound(match);
    });
}

window.applyAsListener = applyAsListener;
window.getListener = getListener;
window.getListenerApplication = getListenerApplication;
window.saveListenerChecks = saveListenerChecks;
window.loadAllListeners = loadAllListeners;
window.approveListener = approveListener;
window.rejectListener = rejectListener;
window.setListenerAvailability = setListenerAvailability;
window.setTrainingComplete = setTrainingComplete;
window.findEligibleListener = findEligibleListener;
