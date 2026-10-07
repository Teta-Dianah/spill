// The "Need help now" button that must appear on every page (NFR 5, BR 8).
// This never reads from Firestore and never needs sign-in, so it keeps
// working even if the network is slow or the user isn't logged in.
// The admin-managed resources page (index.html) has the fuller, kept-up-to-date
// list; this is a fixed safety net that is always there.

function buildCrisisCard() {
  var button = document.createElement('button');
  button.id = 'need-help-now-button';
  button.type = 'button';
  button.textContent = 'Need help now';

  var modal = document.createElement('div');
  modal.id = 'crisis-modal';
  modal.hidden = true;
  modal.innerHTML =
    '<div class="crisis-modal-content">' +
    '<h2>You are not alone</h2>' +
    '<p>These are free, confidential helplines in Rwanda:</p>' +
    '<ul>' +
    '<li><strong>114</strong> &mdash; Rwanda Biomedical Centre helpline</li>' +
    '<li><strong>116</strong> &mdash; Child helpline</li>' +
    '<li><strong>8015</strong> &mdash; Suicide prevention helpline</li>' +
    '</ul>' +
    '<p>If you are in immediate danger, contact local emergency services or go to the nearest hospital.</p>' +
    '<button type="button" id="close-crisis-modal">Close</button>' +
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

document.addEventListener('DOMContentLoaded', buildCrisisCard);
