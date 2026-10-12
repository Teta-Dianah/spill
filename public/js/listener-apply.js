// Wires up the listener application form (FR 5.1).
// Needs listeners.js loaded first.

function showApplyMessage(text) {
  var box = document.getElementById('apply-message');
  if (box) box.textContent = text;
}

function checkExistingApplication(uid) {
  getListener(uid, function (listener) {
    if (!listener) return;

    showApplyMessage('You already applied. Status: ' + listener.status + '.');
    var form = document.getElementById('apply-form');
    if (form) form.hidden = true;
  });
}

document.addEventListener('DOMContentLoaded', function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
      return;
    }
    checkExistingApplication(user.uid);
  });

  var form = document.getElementById('apply-form');
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var user = firebase.auth().currentUser;
      if (!user) return;

      var motivation = form.motivation.value.trim();

      applyAsListener(user.uid, motivation)
        .then(function () {
          showApplyMessage('Application submitted. An admin will review it soon.');
          form.hidden = true;
        })
        .catch(function (error) {
          showApplyMessage('Could not submit your application. Please try again.');
          console.error(error);
        });
    });
  }
});
