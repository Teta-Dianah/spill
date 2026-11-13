// Shows the "Safety check" notice on request-chat.html, once, before a
// person's first chat. Only when the model check is on (see
// model-check-settings.js). The chat works the same whatever they
// choose: "Agree" lets their messages be checked by the model as well,
// "No thanks" keeps their screening to the term lists alone.
// Needs firebase-init.js and model-check-settings.js loaded first.

document.addEventListener('DOMContentLoaded', function () {
  var notice = document.getElementById('model-check-notice');
  var agreeButton = document.getElementById('model-check-agree');
  var declineButton = document.getElementById('model-check-decline');
  if (!notice || !agreeButton || !declineButton) return;

  // Off (the default): the notice stays hidden and nothing else happens.
  if (!isModelCheckOnHere()) return;

  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) return;

    var choice = readModelCheckChoice(window.localStorage, user.uid);
    notice.hidden = !shouldShowModelCheckNotice(true, choice);

    function choose(newChoice) {
      saveModelCheckChoice(window.localStorage, user.uid, newChoice);
      notice.hidden = true;
    }

    agreeButton.onclick = function () {
      choose('agreed');
    };
    declineButton.onclick = function () {
      choose('declined');
    };
  });
});
