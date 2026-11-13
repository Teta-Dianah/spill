// Wires up the sign-up form on signup.html (FR 1.1, FR 1.3).
// Needs auth.js loaded first.

function showSignupMessage(text) {
  var box = document.getElementById('signup-message');
  if (box) box.textContent = text;
}

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('signup-form');
  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var email = form.email.value.trim();
    var password = form.password.value;
    var ageBand = form.ageBand.value;
    var firstTimeAnswer = form.firstTimeSeekingHelp.value;
    var consentGiven = form.consent.checked;

    if (!firstTimeAnswer) {
      showSignupMessage('Please answer whether this is your first time seeking support.');
      return;
    }

    if (!consentGiven) {
      showSignupMessage('Please read and accept the notice above before continuing.');
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
