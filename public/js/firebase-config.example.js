// Copy this file to firebase-config.js. As it is, it works with the local
// emulators: "demo-spill-dev" is an emulator-only project, and the
// emulators never check the other values.
//
// To connect to a real Firebase project, replace every value with the
// ones from Project settings > General > Your apps in the Firebase
// console. firebase-config.js is gitignored on purpose: never commit
// real project values, especially for the pilot project.

var firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'demo-spill-dev',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};
