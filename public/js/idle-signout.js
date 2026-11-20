// Signs a person out after 30 minutes with no taps, clicks or typing
// (FR 1.4), so a phone left lying around, or a shared one, doesn't stay
// signed in to their chats. Load it after firebase-init.js.
//
// The time of the last activity is kept in localStorage, so every open
// Spill tab shares it, and a page opened the next day signs out straight
// away. A chat that is open and in progress counts as activity
// (chat.js sets keepSignedIn), so nobody is signed out mid-conversation.

var IDLE_LIMIT_MS = 30 * 60 * 1000;
var LAST_ACTIVE_KEY = 'spill-last-active';

// True if the last activity was more than 30 minutes before now. With
// no record at all, there's nothing to go on, so it isn't.
function isIdleTooLong(lastActiveMs, nowMs) {
  if (!lastActiveMs) return false;
  return nowMs - lastActiveMs > IDLE_LIMIT_MS;
}

// The browser can refuse localStorage (a private window, for example).
// Then this page's own memory is used instead.
var lastActiveInMemory = 0;

function readLastActive() {
  try {
    var saved = Number(window.localStorage.getItem(LAST_ACTIVE_KEY));
    if (saved) return saved;
  } catch {
    // Fall back to memory below.
  }
  return lastActiveInMemory;
}

function markActive() {
  lastActiveInMemory = Date.now();
  try {
    window.localStorage.setItem(LAST_ACTIVE_KEY, String(lastActiveInMemory));
  } catch {
    // Memory alone is fine.
  }
}

// Set to true by chat.js while a chat is in progress.
var keepSignedIn = false;

function setKeepSignedIn(value) {
  keepSignedIn = value;
  if (value) markActive();
}

function signOutIfIdle() {
  var user = firebase.auth().currentUser;
  if (!user) return;

  if (keepSignedIn) {
    markActive();
    return;
  }

  if (isIdleTooLong(readLastActive(), Date.now())) {
    // The page's own "not signed in" check may send them to the sign-in
    // page first, so the reason is kept here for signin.js to show.
    try {
      window.sessionStorage.setItem('spill-signed-out-idle', 'yes');
    } catch {
      // The sign-in page just won't say why.
    }
    firebase.auth().signOut().then(function () {
      window.location.href = 'signin.html';
    });
  }
}

function startIdleSignOut() {
  // Activity is only noted once every 10 seconds at most, so typing a
  // long message doesn't write to localStorage on every key.
  var lastNoted = 0;
  function noteActivity() {
    var now = Date.now();
    if (now - lastNoted < 10000) return;
    lastNoted = now;
    markActive();
  }
  ['click', 'keydown', 'touchstart', 'scroll'].forEach(function (eventName) {
    window.addEventListener(eventName, noteActivity, { passive: true });
  });

  // Checked once signed in (this catches a page opened long after the
  // last visit), and then every minute.
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) return;
    if (!readLastActive()) markActive();
    signOutIfIdle();
  });
  setInterval(signOutIfIdle, 60 * 1000);
}

if (typeof module !== 'undefined') {
  module.exports = { isIdleTooLong, IDLE_LIMIT_MS };
} else {
  window.markActive = markActive;
  window.setKeepSignedIn = setKeepSignedIn;
  startIdleSignOut();
}
