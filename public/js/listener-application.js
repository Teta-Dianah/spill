// The listener application (FR 5.1, FR 5.2): what an applicant has to
// answer, and what an admin has to confirm before approving.
//
// Spill never asks for a real name, a phone number or an identity
// document (NFR 11). So the checks that need those (identity, two
// references, police clearance and an interview) happen in person, away
// from the app. The applicant gets a reference code to quote, and the
// admin only ticks off that each check was done. Nothing is uploaded.
//
// This file has no Firebase in it, so it is easy to unit test on its own.

// Who an applicant writes to, quoting their reference code, to arrange
// the in-person checks. Replace this with the real address for a pilot.
var VETTING_CONTACT_EMAIL = 'listeners@spill.example';

var MIN_ANSWER_LENGTH = 30;
var MAX_ANSWER_LENGTH = 1000;
var MIN_REJECTION_REASON_LENGTH = 5;
var MAX_REJECTION_REASON_LENGTH = 500;

var HOURS_PER_WEEK_OPTIONS = ['1-2', '3-5', '6-plus'];

// The four checks an admin confirms happened in person. All four are
// needed before a listener can be approved.
var OFFLINE_CHECKS = [
  { key: 'identity', label: 'Identity seen in person (shows they are 21 or older)' },
  { key: 'references', label: 'Two references contacted' },
  { key: 'policeClearance', label: 'Police clearance certificate seen' },
  { key: 'interview', label: 'Interview held' },
];

// Letters and digits that are hard to mix up when read aloud or typed:
// no 0 or O, no 1 or I.
var CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Makes a reference code like "SPL-7K2QXD". randomNumber is a function
// returning a number from 0 up to (not including) 1, like Math.random.
function makeReferenceCode(randomNumber) {
  var code = 'SPL-';
  for (var i = 0; i < 6; i++) {
    code += CODE_CHARACTERS.charAt(Math.floor(randomNumber() * CODE_CHARACTERS.length));
  }
  return code;
}

function cleanAnswer(text) {
  return typeof text === 'string' ? text.trim() : '';
}

// Checks what an applicant typed. Returns { application: {...} } with
// the cleaned answers ready to save, or { error: 'message' } naming the
// first thing to fix. answers is a plain object read from the form.
function checkListenerApplication(answers) {
  if (!answers || answers.confirmedAge21 !== true) {
    return { error: 'Listeners need to be 21 or older. Please confirm your age.' };
  }

  var required = [
    { key: 'motivation', name: 'why you want to be a listener' },
    { key: 'scenarioCrisis', name: 'the first situation' },
    { key: 'scenarioContact', name: 'the second situation' },
  ];
  var cleaned = {};
  for (var i = 0; i < required.length; i++) {
    var answer = cleanAnswer(answers[required[i].key]);
    if (answer.length < MIN_ANSWER_LENGTH) {
      return { error: 'Please say a little more about ' + required[i].name + ' (at least ' + MIN_ANSWER_LENGTH + ' characters).' };
    }
    if (answer.length > MAX_ANSWER_LENGTH) {
      return { error: 'Please keep your answer about ' + required[i].name + ' under ' + MAX_ANSWER_LENGTH + ' characters.' };
    }
    cleaned[required[i].key] = answer;
  }

  var experience = cleanAnswer(answers.experience);
  if (experience.length > MAX_ANSWER_LENGTH) {
    return { error: 'Please keep your experience under ' + MAX_ANSWER_LENGTH + ' characters.' };
  }

  if (HOURS_PER_WEEK_OPTIONS.indexOf(answers.hoursPerWeek) === -1) {
    return { error: 'Please choose how many hours a week you can give.' };
  }

  if (answers.agreedConduct !== true) {
    return { error: 'Please read and agree to the listener code of conduct.' };
  }
  if (answers.agreedChecks !== true) {
    return { error: 'Please agree to the in-person checks. Nobody can listen without them.' };
  }

  return {
    application: {
      confirmedAge21: true,
      motivation: cleaned.motivation,
      experience: experience,
      hoursPerWeek: answers.hoursPerWeek,
      scenarioCrisis: cleaned.scenarioCrisis,
      scenarioContact: cleaned.scenarioContact,
      agreedConduct: true,
      agreedChecks: true,
    },
  };
}

// True only when every in-person check has been ticked. checks is the
// object saved on the application, like { identity: true, ... }.
function allChecksDone(checks) {
  if (!checks) return false;
  return OFFLINE_CHECKS.every(function (check) {
    return checks[check.key] === true;
  });
}

// Checks the reason an admin gives for rejecting. Returns the cleaned
// reason, or '' if it is too short or too long to accept.
function cleanRejectionReason(reason) {
  var cleaned = cleanAnswer(reason);
  if (cleaned.length < MIN_REJECTION_REASON_LENGTH || cleaned.length > MAX_REJECTION_REASON_LENGTH) return '';
  return cleaned;
}

// Works out where an applicant is, for the progress list on the apply
// page. listener is their listeners record (null if they have not
// applied). Returns the number of the step they are on now, or 0 if they
// have not applied, or -1 if the application was rejected.
//   1 Application sent (done as soon as they have applied)
//   2 In-person checks (where they wait until an admin approves)
//   3 Approved (done as soon as it happens)
//   4 Training
//   5 Ready to listen
function applicationStep(listener) {
  if (!listener) return 0;
  if (listener.status === 'rejected') return -1;
  if (listener.status !== 'approved') return 2;
  if (!listener.trainingComplete) return 4;
  return 5;
}

// This guard only matters for our Jest tests, which run in Node.
if (typeof module !== 'undefined') {
  module.exports = {
    VETTING_CONTACT_EMAIL,
    MIN_ANSWER_LENGTH,
    MAX_ANSWER_LENGTH,
    HOURS_PER_WEEK_OPTIONS,
    OFFLINE_CHECKS,
    makeReferenceCode,
    checkListenerApplication,
    allChecksDone,
    cleanRejectionReason,
    applicationStep,
  };
}
