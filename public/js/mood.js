// Saving and loading mood check-ins (FR 3.1, FR 3.3).
// Needs mood-validate.js and firebase-init.js loaded first.

function recordMood(uid, score, note) {
  var entry = {
    uid: uid,
    score: score,
    note: note || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  var errors = validateMood(entry);
  if (errors.length > 0) {
    return Promise.reject(new Error(errors.join(' ')));
  }

  return firebase.firestore().collection('moods').add(entry);
}

// Fetches a user's mood entries and hands back the 20 most recent,
// newest first. Sorting happens here in JavaScript instead of in the
// Firestore query, which keeps this simple and avoids needing a
// composite index for a small pilot's worth of data.
function loadMoodHistory(uid, onLoaded) {
  firebase
    .firestore()
    .collection('moods')
    .where('uid', '==', uid)
    .get()
    .then(function (snapshot) {
      var entries = [];
      snapshot.forEach(function (docSnap) {
        entries.push(docSnap.data());
      });

      entries.sort(function (a, b) {
        var aTime = a.createdAt ? a.createdAt.toMillis() : 0;
        var bTime = b.createdAt ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });

      onLoaded(entries.slice(0, 20));
    });
}

// Makes these available to dashboard.js, which loads after this file.
window.recordMood = recordMood;
window.loadMoodHistory = loadMoodHistory;
