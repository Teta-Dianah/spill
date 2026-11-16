// The "Need help now" button that must appear on every page (NFR 5, BR 8).
// This never reads from Firestore and never needs sign-in, so it keeps
// working even if the network is slow or the user isn't logged in.
// The admin-managed resources page (index.html) has the fuller, kept-up-to-date
// list; this is a fixed safety net that is always there.

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
    crisisLine('114', 'Rwanda Biomedical Centre helpline') +
    crisisLine('116', 'Child helpline / RIB') +
    crisisLine('0793 902 059', 'Kigali Mental Health Referral Centre') +
    '</ul>' +
    '<p>If you are in immediate danger, contact local emergency services or go to the nearest hospital.</p>' +
    '<button type="button" id="close-crisis-modal" class="button-secondary">Close</button>' +
    '</div>';

  document.body.appendChild(button);
  document.body.appendChild(modal);

  button.addEventListener('click', function () {
    modal.hidden = false;
  });

  modal.querySelector('#close-crisis-modal').addEventListener('click', function () {
    modal.hidden = true;
  });
}

// Lets other scripts (chat.js, on crisis wording) open the card
// directly, not just the button click — FR 6.2 shows it automatically.
function showCrisisCard() {
  var modal = document.getElementById('crisis-modal');
  if (modal) modal.hidden = false;
}

document.addEventListener('DOMContentLoaded', buildCrisisCard);

window.showCrisisCard = showCrisisCard;
