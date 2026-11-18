// Wires up the sign-up form on signup.html (FR 1.1, FR 1.3).
// Needs auth.js loaded first.

function showSignupMessage(text) {
  var box = document.getElementById('signup-message');
  if (box) box.textContent = text;
}

// Shown instead of the rest of the form to someone under 16. Kind, and
// points to help that needs no account.
function showUnder16Note(show) {
  var note = document.getElementById('under-16-note');
  var rest = document.getElementById('signup-rest');
  if (note) note.hidden = !show;
  if (rest) rest.hidden = show;
}

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('signup-form');
  if (!form) return;

  // FR 1.1: choosing "Under 16" shows a note and hides the rest of the
  // form straight away, so nobody fills it in for nothing.
  form.querySelectorAll('input[name="ageBand"]').forEach(function (choice) {
    choice.addEventListener('change', function () {
      showUnder16Note(form.ageBand.value === 'under-16');
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var email = form.email.value.trim();
    var password = form.password.value;
    var ageBand = form.ageBand.value;
    var firstTimeAnswer = form.firstTimeSeekingHelp.value;
    var consentGiven = form.consent.checked;

    // Checked before anything is created, so no sign-in is ever made for
    // someone under 16. firestore.rules refuses any other age band too.
    if (!isAllowedAgeBand(ageBand)) {
      showUnder16Note(ageBand === 'under-16');
      showSignupMessage(ageBand === 'under-16' ? '' : 'Please choose your age.');
      return;
    }

    if (!firstTimeAnswer) {
      showSignupMessage('Please answer whether this is your first time seeking support.');
      return;
    }

    if (!consentGiven) {
      showSignupMessage('Please read and accept the privacy notice and terms before continuing.');
      return;
    }

    var firstTimeSeekingHelp = firstTimeAnswer === 'yes';

    registerUser(email, password, ageBand, firstTimeSeekingHelp)
      .then(function (pseudonym) {
        showSignupMessage('Account created. Your name here is ' + pseudonym + '.');
        window.location.href = 'dashboard.html';
      })
      .catch(function (error) {
        showSignupMessage('Could not create your account. Please check your details and try again.');
        console.error(error);
      });
  });
});
