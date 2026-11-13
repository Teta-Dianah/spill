// Decides whether the model check (model-check.js) may run, and
// remembers each person's answer to the "Safety check" notice.
//
// The model check is OFF unless two things are both true:
//   1. firebase-config.js sets modelCheckEnabled to true, and
//   2. the project is on the short list below.
// So it can never turn itself on for another project, even if someone
// copies a config file with the setting left on.
//
// Even when it is on, it is used only for a person who pressed "Agree"
// on the notice. For everyone else, screening is the term lists alone.
// This file has no Firebase in it, so it is easy to unit test on its own.

// The only projects where the model check is allowed: the development
// project. Not the pilot project, and not the emulator-only project.
var MODEL_CHECK_PROJECTS = ['spill-dev-01'];

// config is the firebaseConfig object; enabled is the modelCheckEnabled
// setting from the same file. Only the real value true counts.
function isModelCheckOn(config, enabled) {
  if (enabled !== true || !config) return false;
  return MODEL_CHECK_PROJECTS.indexOf(config.projectId) !== -1;
}

// The same question for the page that is running now, using the values
// from firebase-config.js. A config file from before this setting
// existed has no modelCheckEnabled, which counts as off.
function isModelCheckOnHere() {
  if (typeof firebaseConfig === 'undefined' || typeof modelCheckEnabled === 'undefined') {
    return false;
  }
  return isModelCheckOn(firebaseConfig, modelCheckEnabled);
}

// The choice is kept per account, so two people sharing one browser
// each get asked.
function modelCheckChoiceKey(uid) {
  return 'spill-model-check-choice-' + uid;
}

// Returns 'agreed', 'declined' or '' (not answered yet). storage is the
// browser's localStorage. If it can't be read, that counts as not
// answered, so the model check is not used.
function readModelCheckChoice(storage, uid) {
  try {
    var choice = storage.getItem(modelCheckChoiceKey(uid));
    return choice === 'agreed' || choice === 'declined' ? choice : '';
  } catch {
    return '';
  }
}

function saveModelCheckChoice(storage, uid, choice) {
  try {
    storage.setItem(modelCheckChoiceKey(uid), choice);
  } catch {
    // Nothing to do: the person is simply asked again next time.
  }
}

// The notice is shown only when the model check is on and this person
// has not answered yet.
function shouldShowModelCheckNotice(isOn, choice) {
  return isOn && choice === '';
}

// A message may be sent to the model only when the check is on and the
// person who wrote it agreed.
function canUseModelCheck(isOn, choice) {
  return isOn && choice === 'agreed';
}

// This guard only matters for our Jest tests, which run in Node.
if (typeof module !== 'undefined') {
  module.exports = {
    MODEL_CHECK_PROJECTS,
    isModelCheckOnHere,
    isModelCheckOn,
    readModelCheckChoice,
    saveModelCheckChoice,
    shouldShowModelCheckNotice,
    canUseModelCheck,
  };
}
