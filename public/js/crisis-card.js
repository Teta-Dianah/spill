// The "Need help now" button that must appear on every page (NFR 5, BR 8).
// This never reads from Firestore and never needs sign-in, so it keeps
// working even if the network is slow or the user isn't logged in.
// The admin-managed resources page (index.html) has the fuller, kept-up-to-date
// list; this is a fixed safety net that is always there.

// The helplines built into Spill. They never depend on the database, so
// they are always there: on the crisis card on every page, and on the
// landing page when its admin-managed list is empty or can't load.
var BUILT_IN_HELPLINES = [
  { number: '114', name: 'Rwanda Biomedical Centre helpline' },
  { number: '116', name: 'Child helpline / RIB' },
  { number: '0793 902 059', name: 'Kigali Mental Health Referral Centre' },
];

// One helpline: its number, what it is, and a button that starts a call
// on a phone. The numbers are fixed in this file, not typed by anyone,
// so there is nothing here to escape.
function crisisLine(number, name) {
  // A longer number is written with spaces so it is easy to read. The
  // link that starts the call needs it without them.
  var dial = number.replace(/ /g, '');
  return (
    '<li>' +
    '<span class="crisis-line-text"><strong>' + number + '</strong>' + name + '</span>' +
    '<a class="button" href="tel:' + dial + '" aria-label="Call ' + number + '">Call</a>' +
    '</li>'
  );
}

function buildCrisisCard() {
  var button = document.createElement('button');
  button.id = 'need-help-now-button';
  button.type = 'button';
  button.textContent = 'Need help now';

  var modal = document.createElement('div');
  modal.id = 'crisis-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'crisis-modal-title');
  modal.innerHTML =
    '<div class="crisis-modal-content">' +
    '<h2 id="crisis-modal-title">You are not alone.</h2>' +
    '<p>You can call any of these in Rwanda.</p>' +
    '<ul class="crisis-lines">' +
    BUILT_IN_HELPLINES.map(function (line) {
      return crisisLine(line.number, line.name);
    }).join('') +
    '</ul>' +
    '<p>If you are in immediate danger, contact local emergency services or go to the nearest hospital.</p>' +
    '<button type="button" id="close-crisis-modal" class="button-secondary">Close</button>' +
    '</div>';

  // The button goes first on the page, so a keyboard user reaches it with
  // the very first Tab (NFR 5, NFR 16). It still shows fixed at the
  // bottom of the screen.
  document.body.insertBefore(button, document.body.firstChild);
  document.body.appendChild(modal);

  button.addEventListener('click', showCrisisCard);
  modal.querySelector('#close-crisis-modal').addEventListener('click', closeCrisisCard);

  // While the card is open: Escape closes it, and Tab stays inside it,
  // going round from the last control to the first (NFR 16).
  modal.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeCrisisCard();
      return;
    }
    if (event.key !== 'Tab') return;
    var controls = modal.querySelectorAll('a[href], button');
    var first = controls[0];
    var last = controls[controls.length - 1];
    var title = document.getElementById('crisis-modal-title');
    if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

// Where focus was before the card opened, to put it back on close.
var focusBeforeCrisisCard = null;

// Opens the card and moves focus to its heading, so a screen reader reads
// "You are not alone." and the helplines come next with Tab. Other
// scripts (chat.js, on crisis wording) open it this way too; FR 6.2 shows
// it automatically.
function showCrisisCard() {
  var modal = document.getElementById('crisis-modal');
  if (!modal) return;
  if (modal.hidden) focusBeforeCrisisCard = document.activeElement;
  modal.hidden = false;
  var title = document.getElementById('crisis-modal-title');
  title.setAttribute('tabindex', '-1');
  title.focus();
}

function closeCrisisCard() {
  var modal = document.getElementById('crisis-modal');
  if (!modal) return;
  modal.hidden = true;
  var back = focusBeforeCrisisCard;
  focusBeforeCrisisCard = null;
  if (back && back !== document.body && document.contains(back)) back.focus();
  else document.getElementById('need-help-now-button').focus();
}

document.addEventListener('DOMContentLoaded', buildCrisisCard);

window.showCrisisCard = showCrisisCard;
window.BUILT_IN_HELPLINES = BUILT_IN_HELPLINES;
