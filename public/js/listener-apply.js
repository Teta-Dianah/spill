// Wires up the listener application page (FR 5.1): the form for someone
// who has not applied yet, and the progress list for someone who has.
// Needs listener-application.js and listeners.js loaded first.

function showApplyMessage(text) {
  var box = document.getElementById('apply-message');
  if (box) box.textContent = text;
}

// What the person should do next, for each step of applicationStep().
function nextStepText(step) {
  if (step === -1) return 'Your application was not accepted this time. Thank you for offering to help.';
  if (step === 2) {
    return 'Next: write to ' + VETTING_CONTACT_EMAIL + ' with your reference code to arrange your in-person checks. ' +
      'Bring your ID and your police clearance certificate, and the contact details of two people who know you well.';
  }
  if (step === 4) return 'You are approved. Next: finish the listener training.';
  if (step === 5) return 'You are ready. Set yourself available on your listener dashboard when you want to take chats.';
  return '';
}

// Marks each step in the list as done, current or still to come. The
// words "Done" and "Now" are added too, so it never depends on colour.
function renderSteps(step) {
  var items = document.querySelectorAll('#apply-steps li');
  for (var i = 0; i < items.length; i++) {
    var number = i + 1;
    var tag = items[i].querySelector('.tag');
    if (tag) items[i].removeChild(tag);

    var state = '';
    if (step === 5 || number < step || (step === 4 && number === 3)) state = 'Done';
    else if (number === step) state = 'Now';

    items[i].className = state === 'Done' ? 'step-done' : state === 'Now' ? 'step-current' : '';
    if (state) {
      var label = document.createElement('span');
      label.className = 'tag' + (state === 'Now' ? ' tag-severity-2' : '');
      label.textContent = state;
      items[i].appendChild(label);
    }
  }
}

function showApplicationStatus(listener, application) {
  var step = applicationStep(listener);
  document.getElementById('apply-form').hidden = true;
  document.getElementById('apply-status').hidden = false;
  document.getElementById('apply-reference').textContent = application ? application.referenceCode : 'not on file';
  document.getElementById('apply-next').textContent = nextStepText(step);
  document.getElementById('apply-steps').hidden = step === -1;
  renderSteps(step);

  if (step === 4) {
    var link = document.createElement('a');
    link.href = 'listener-training.html';
    link.className = 'button';
    link.textContent = 'Start the training';
    document.getElementById('apply-status').appendChild(link);
  }
}

// Decides what to show: the progress list, a note that the person is too
// young, or the form.
function startApplyPage(user) {
  getListener(user.uid, function (listener) {
    if (listener) {
      getListenerApplication(user.uid, function (application) {
        showApplicationStatus(listener, application);
      });
      return;
    }

    firebase
      .firestore()
      .collection('accounts')
      .doc(user.uid)
      .get()
      .then(function (accountDoc) {
        var ageBand = accountDoc.exists ? accountDoc.data().ageBand : null;
        if (ageBand !== '18-25') {
          showApplyMessage('Listeners need to be 21 or older, so this account cannot apply. Thank you for wanting to help.');
          return;
        }
        document.getElementById('apply-form').hidden = false;
      });
  });
}

function readApplicationForm(form) {
  return {
    confirmedAge21: form.confirmedAge21.checked,
    motivation: form.motivation.value,
    experience: form.experience.value,
    hoursPerWeek: form.hoursPerWeek.value,
    scenarioCrisis: form.scenarioCrisis.value,
    scenarioContact: form.scenarioContact.value,
    agreedConduct: form.agreedConduct.checked,
    agreedChecks: form.agreedChecks.checked,
  };
}

document.addEventListener('DOMContentLoaded', function () {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
      return;
    }
    startApplyPage(user);
  });

  var form = document.getElementById('apply-form');
  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var user = firebase.auth().currentUser;
    if (!user) return;

    var checked = checkListenerApplication(readApplicationForm(form));
    if (checked.error) {
      showApplyMessage(checked.error);
      return;
    }

    var application = checked.application;
    application.referenceCode = makeReferenceCode(Math.random);

    applyAsListener(user.uid, application)
      .then(function () {
        showApplyMessage('Application sent.');
        startApplyPage(user);
      })
      .catch(function (error) {
        showApplyMessage('Could not send your application. Please try again.');
        console.error(error);
      });
  });
});
