// The checks run before a deploy (scripts/deploy.js) and after it
// (scripts/smoke-check.js). They only look at text, so the unit tests can
// check them without Firebase or the network.

// The two real projects, as named in .firebaserc (NFR 22).
const TARGETS = ['dev', 'pilot'];

// Reads projectId and modelCheckEnabled out of a firebase-config.js file.
function readConfig(configText) {
  const projectId = (configText.match(/projectId:\s*'([^']*)'/) || [])[1] || '';
  const modelCheck = (configText.match(/var modelCheckEnabled\s*=\s*(true|false)\s*;/) || [])[1];
  return {
    projectId,
    modelCheckEnabled: modelCheck === 'true',
    hasPlaceholders: configText.includes('REPLACE_ME'),
  };
}

// Everything that would make this deploy go wrong, as plain sentences.
// An empty list means it is safe to go ahead.
//   target:     'dev' or 'pilot'
//   configText: the config file that will be uploaded for this target
//   projectId:  the project .firebaserc names for this target
//   git:        { branch, clean } for the working copy
function deployProblems(target, configText, projectId, git) {
  const problems = [];
  if (!TARGETS.includes(target)) {
    return [`Unknown target "${target}". Use one of: ${TARGETS.join(', ')}.`];
  }
  if (!projectId) problems.push(`.firebaserc names no project for "${target}".`);

  if (configText === null) {
    problems.push(`There is no config/firebase-config.${target}.js. See "Deployment" in the README.`);
  } else {
    const config = readConfig(configText);
    if (config.hasPlaceholders) problems.push(`config/firebase-config.${target}.js still has REPLACE_ME values.`);
    if (config.projectId !== projectId) {
      problems.push(
        `config/firebase-config.${target}.js is for "${config.projectId || 'no project'}", but "${target}" deploys to "${projectId}". ` +
          'The site would talk to the wrong project.'
      );
    }
    if (target === 'pilot' && config.modelCheckEnabled) {
      problems.push('The model check is a demo prototype and must stay off for the pilot: set modelCheckEnabled to false.');
    }
  }

  if (!git.clean) problems.push('There are changes that are not committed. Commit or put them aside first, so the deploy matches the code in git.');
  if (target === 'pilot' && git.branch !== 'main') {
    problems.push(`The pilot is only deployed from main, the reviewed code. You are on "${git.branch}".`);
  }
  return problems;
}

module.exports = { TARGETS, readConfig, deployProblems };
