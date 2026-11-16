// Lets an admin review listener applications (FR 5.2): read the answers,
// tick off the four in-person checks, then approve or reject.
// Firestore Security Rules are the real gatekeeper. They refuse an
// approval until every check is ticked, a rejection without a reason,
// and any step without its auditLog entry. This page just gives an admin
// a form to use. Needs listener-application.js and listeners.js loaded
// first.

function showAdminListenersMessage(text) {
  var box = document.getElementById('admin-listeners-message');
  if (box) box.textContent = text;
}

function getPseudonym(uid, onLoaded) {
  firebase
    .firestore()
    .collection('accounts')
    .doc(uid)
    .get()
    .then(function (accountDoc) {
      onLoaded(accountDoc.exists ? accountDoc.data().pseudonym : uid);
    });
}

// Makes an element with text in it. Everything an applicant wrote is
// shown this way, with textContent, so it can't inject anything.
function makeElement(tagName, text, className) {
  var element = document.createElement(tagName);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function describeStatus(listener) {
  if (listener.status === 'approved') {
    return listener.clearedForMinors ? 'Approved, cleared for 16 to 17 year olds' : 'Approved';
  }
  if (listener.status === 'rejected') return 'Rejected';
  return 'Waiting for review';
}

var HOURS_LABELS = { '1-2': '1 to 2 hours a week', '3-5': '3 to 5 hours a week', '6-plus': '6 or more hours a week' };

// One question and the applicant's answer.
function renderAnswer(question, answer) {
  var block = document.createElement('div');
  block.className = 'answer';
  block.appendChild(makeElement('p', question, 'answer-question'));
  block.appendChild(makeElement('p', answer || 'No answer given.'));
  return block;
}

// The four tick boxes and their Save button.
function renderChecks(listener, application, adminUid) {
  var box = document.createElement('fieldset');
  box.appendChild(makeElement('legend', 'In-person checks'));

  var saved = application.checks || {};
  var inputs = {};
  OFFLINE_CHECKS.forEach(function (check) {
    var label = makeElement('label', '', 'option');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = saved[check.key] === true;
    inputs[check.key] = input;
    label.appendChild(input);
    label.appendChild(document.createTextNode(check.label));
    box.appendChild(label);
  });

  var saveButton = makeElement('button', 'Save checks', 'button-secondary');
  saveButton.type = 'button';
  saveButton.addEventListener('click', function () {
    var checks = {};
    OFFLINE_CHECKS.forEach(function (check) {
      checks[check.key] = inputs[check.key].checked;
    });
    saveListenerChecks(listener.uid, checks, adminUid)
      .then(function () {
        showAdminListenersMessage('Checks saved.');
        renderListeners(adminUid);
      })
      .catch(function (error) {
        showAdminListenersMessage('Could not save the checks. Please try again.');
        console.error(error);
      });
  });
  box.appendChild(saveButton);
  return box;
}

// Approve (two ways) and reject, for an application still waiting.
function renderDecision(listener, application, adminUid) {
  var box = document.createElement('div');
  var ready = allChecksDone(application.checks);

  if (!ready) {
    box.appendChild(makeElement('p', 'Tick and save all four checks before approving.', 'hint'));
  }

  var approveRow = makeElement('div', '', 'actions');
  [
    { label: 'Approve', minors: false, className: '' },
    { label: 'Approve and clear for 16 to 17 year olds', minors: true, className: 'button-secondary' },
  ].forEach(function (choice) {
    var button = makeElement('button', choice.label, choice.className);
    button.type = 'button';
    button.disabled = !ready;
    button.addEventListener('click', function () {
      approveListener(listener.uid, choice.minors, adminUid)
        .then(function () {
          showAdminListenersMessage('Listener approved.');
          renderListeners(adminUid);
        })
        .catch(function (error) {
          showAdminListenersMessage('Could not approve. Check that all four checks are saved.');
          console.error(error);
        });
    });
    approveRow.appendChild(button);
  });
  box.appendChild(approveRow);

  var reasonId = 'reject-reason-' + listener.uid;
  var reasonLabel = makeElement('label', 'Reason for rejecting');
  reasonLabel.htmlFor = reasonId;
  var reasonInput = document.createElement('textarea');
  reasonInput.id = reasonId;
  reasonInput.rows = 2;
  reasonInput.maxLength = 500;
  var rejectButton = makeElement('button', 'Reject', 'button-danger-link');
  rejectButton.type = 'button';
  rejectButton.addEventListener('click', function () {
    var reason = cleanRejectionReason(reasonInput.value);
    if (!reason) {
      showAdminListenersMessage('Give a short reason before rejecting (at least 5 characters).');
      return;
    }
    rejectListener(listener.uid, reason, adminUid)
      .then(function () {
        showAdminListenersMessage('Application rejected.');
        renderListeners(adminUid);
      })
      .catch(function (error) {
        showAdminListenersMessage('Could not reject. Please try again.');
        console.error(error);
      });
  });
  box.appendChild(reasonLabel);
  box.appendChild(reasonInput);
  box.appendChild(rejectButton);
  return box;
}

function renderListenerRow(listener, adminUid) {
  var row = makeElement('li', '', 'application card');

  var heading = makeElement('h2', listener.uid);
  getPseudonym(listener.uid, function (pseudonym) {
    heading.textContent = pseudonym;
  });
  row.appendChild(heading);
  row.appendChild(makeElement('span', describeStatus(listener), 'tag'));

  getListenerApplication(listener.uid, function (application) {
    if (!application) {
      row.appendChild(makeElement('p', 'No application on file for this person.', 'hint'));
      return;
    }

    row.appendChild(makeElement('p', 'Reference code: ' + application.referenceCode));

    if (listener.status === 'rejected') {
      row.appendChild(makeElement('p', 'Reason: ' + (application.rejectionReason || 'not recorded')));
      return;
    }
    if (listener.status === 'approved') return;

    row.appendChild(renderAnswer('Why do you want to be a listener?', application.motivation));
    row.appendChild(renderAnswer('Experience supporting someone', application.experience));
    row.appendChild(renderAnswer('Time they can give', HOURS_LABELS[application.hoursPerWeek]));
    row.appendChild(renderAnswer('Someone says they are thinking about ending their life', application.scenarioCrisis));
    row.appendChild(renderAnswer('Someone asks for their phone number', application.scenarioContact));
    row.appendChild(renderChecks(listener, application, adminUid));
    row.appendChild(renderDecision(listener, application, adminUid));
  });

  return row;
}

function renderListeners(adminUid) {
  var list = document.getElementById('listeners-list');
  if (!list) return;

  loadAllListeners(function (listeners) {
    list.innerHTML = '';

    if (listeners.length === 0) {
      list.innerHTML = '<li>No applications yet.</li>';
      return;
    }

    // Applications still waiting come first.
    listeners.sort(function (a, b) {
      return (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1);
    });
    listeners.forEach(function (listener) {
      list.appendChild(renderListenerRow(listener, adminUid));
    });
  });
}

function checkAdminAndStart() {
  firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
      showAdminListenersMessage('Please sign in as an admin to manage listeners.');
      return;
    }

    firebase
      .firestore()
      .collection('accounts')
      .doc(user.uid)
      .get()
      .then(function (accountDoc) {
        var role = accountDoc.exists ? accountDoc.data().role : null;
        if (role !== 'admin') {
          showAdminListenersMessage('You do not have access to this page.');
          return;
        }

        renderListeners(user.uid);
      });
  });
}

document.addEventListener('DOMContentLoaded', checkAdminAndStart);
