// Listener applications, approval and availability (FR 5).
// Needs firebase-init.js loaded first.

function applyAsListener(uid, motivation) {
  return firebase
    .firestore()
    .collection('listeners')
    .doc(uid)
    .set({
      status: 'pending',
      clearedForMinors: false,
      available: false,
      trainingComplete: false,
      motivation: motivation || '',
      appliedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
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

function approveListener(uid, clearedForMinors) {
  return firebase.firestore().collection('listeners').doc(uid).update({
    status: 'approved',
    clearedForMinors: !!clearedForMinors,
  });
}

function rejectListener(uid) {
  return firebase.firestore().collection('listeners').doc(uid).update({
    status: 'rejected',
  });
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
function findEligibleListener(ageBand, onFound) {
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
        var listener = docSnap.data();
        if (ageBand === '16-17' && !listener.clearedForMinors) return;
        match = docSnap.id;
      });
      onFound(match);
    });
}

window.applyAsListener = applyAsListener;
window.getListener = getListener;
window.loadAllListeners = loadAllListeners;
window.approveListener = approveListener;
window.rejectListener = rejectListener;
window.setListenerAvailability = setListenerAvailability;
window.setTrainingComplete = setTrainingComplete;
window.findEligibleListener = findEligibleListener;
