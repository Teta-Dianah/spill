// Wires up the sign-in form on signin.html (FR 1.4).
// Needs auth.js loaded first.

function showSigninMessage(text) {
  var box = document.getElementById('signin-message');
  if (box) box.textContent = text;
}

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('signin-form');
  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var email = form.email.value.trim();
    var password = form.password.value;

    signIn(email, password)
      .then(function () {
        window.location.href = 'dashboard.html';
      })
      .catch(function () {
        // Always the same message, whether the email exists or the
        // password is wrong (NFR: sign-in errors must not reveal
        // whether an email exists).
        showSigninMessage('That email and password combination did not work. Please try again.');
      });
  });
});
