// Wires up the listener training quiz (FR 5.3).
// Needs listeners.js loaded first. The correct answers are checked here,
// in the browser — fine for a training check, not an access-control
// decision, so there's no need for this to live in Security Rules.

var CORRECT_ANSWERS = { q1: 'b', q2: 'b', q3: 'b' };

function showQuizMessage(text) {
  var box = document.getElementById('quiz-message');
  if (box) box.textContent = text;
}

function allAnswersCorrect(form) {
  return Object.keys(CORRECT_ANSWERS).every(function (question) {
    return form[question].value === CORRECT_ANSWERS[question];
  });
}

document.addEventListener('DOMContentLoaded', function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
    }
  });

  var form = document.getElementById('quiz-form');
  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var user = firebase.auth().currentUser;
    if (!user) return;

    if (!allAnswersCorrect(form)) {
      showQuizMessage('Not quite — have another look and try again.');
      return;
    }

    setTrainingComplete(user.uid)
      .then(function () {
        showQuizMessage('Training complete. You can now set yourself available on your listener dashboard.');
      })
      .catch(function () {
        showQuizMessage('Please apply as a listener before taking this quiz.');
      });
  });
});
