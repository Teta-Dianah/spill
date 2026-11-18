// Deploys Spill to the development or the pilot project, safely.
//
// Usage:
//   npm run deploy:dev
//   npm run deploy:pilot
//
// Each project has its own web config in config/firebase-config.<target>.js
// (gitignored). This script:
//   1. checks the config matches the project, that the model check is off
//      for the pilot, that nothing is uncommitted, and that the pilot is
//      only deployed from main;
//   2. runs every test and the linter;
//   3. puts that config in public/js/firebase-config.js for the upload;
//   4. deploys the site first, then the Security Rules and indexes. The
//      site goes first because new rules can expect what a new page sends
//      (the consent record at sign-up, for example);
//   5. puts your own public/js/firebase-config.js back as it was;
//   6. checks the live site (scripts/smoke-check.js).
// It stops at the first problem.

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { deployProblems } = require('./deploy-checks.js');

const ROOT = path.join(__dirname, '..');
const LIVE_CONFIG = path.join(ROOT, 'public', 'js', 'firebase-config.js');

function run(command) {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, { cwd: ROOT, shell: true, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`"${command}" did not succeed, so nothing more was deployed.`);
  }
}

function gitState() {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT }).toString().trim();
  const changes = execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
  return { branch, clean: changes === '' };
}

function main() {
  const target = process.argv[2];
  const projects = JSON.parse(fs.readFileSync(path.join(ROOT, '.firebaserc'), 'utf8')).projects;
  const projectId = projects[target];
  const configFile = path.join(ROOT, 'config', `firebase-config.${target}.js`);
  const configText = fs.existsSync(configFile) ? fs.readFileSync(configFile, 'utf8') : null;

  const problems = deployProblems(target, configText, projectId, gitState());
  if (problems.length) {
    console.error('Not deploying:\n' + problems.map((problem) => '- ' + problem).join('\n'));
    process.exit(1);
  }

  console.log(`Deploying to "${target}" (${projectId}).`);
  run('npm test');
  run('npm run lint');

  const ownConfig = fs.existsSync(LIVE_CONFIG) ? fs.readFileSync(LIVE_CONFIG, 'utf8') : null;
  fs.copyFileSync(configFile, LIVE_CONFIG);
  try {
    run(`npx firebase deploy --only hosting --project ${projectId}`);
    run(`npx firebase deploy --only firestore:rules,firestore:indexes --project ${projectId}`);
  } finally {
    if (ownConfig === null) fs.unlinkSync(LIVE_CONFIG);
    else fs.writeFileSync(LIVE_CONFIG, ownConfig);
  }

  run(`node scripts/smoke-check.js ${target}`);
  console.log(`\nDone: https://${projectId}.web.app`);
}

try {
  main();
} catch (error) {
  console.error('\n' + error.message);
  process.exit(1);
}
