// Starts Firebase for every page. Must load after the firebase-*-compat.js
// CDN scripts and after firebase-config.js.
//
// On localhost this points at the local emulators instead of the real
// project, so nothing we do while developing touches live data.

firebase.initializeApp(firebaseConfig);

var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if (isLocal) {
  firebase.auth().useEmulator('http://localhost:9099');
  firebase.firestore().useEmulator('localhost', 8080);
}
