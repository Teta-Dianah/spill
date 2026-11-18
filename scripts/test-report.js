// Writes docs/test-report.md from a full test run: how many tests ran in
// each file, whether they passed, and which requirements (FR, NFR, BR)
// the tests name.
//
// Usage: npm run test:report
// That runs every test, including the Security Rules tests on the
// Firestore emulator, the same way "npm test" does, saves Jest's results
// to test-results.json (not committed), then writes the report. The
// report is written even when a test fails, and lists the failures.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RESULTS_FILE = path.join(ROOT, 'test-results.json');
const REPORT_FILE = path.join(ROOT, 'docs', 'test-report.md');

// What each test file covers, in plain words.
const FILE_NOTES = {
  'test/rules/firestore.test.js': 'Security Rules on the Firestore emulator: who can read and write what',
  'test/rules/lockdown.test.js': 'The lock-down rules for a data breach refuse everything but the helplines',
  'test/unit/screening.test.js': 'Message screening, admin terms and the model check answer handling',
  'test/unit/screening-report.test.js': 'The screening report stays in step with the code',
  'test/unit/test-report.test.js': 'This report: finding requirement IDs and listing failures',
  'test/unit/deploy-checks.test.js': 'A deploy goes to the right project, from the right branch, with the model check off for the pilot',
  'test/unit/pages.test.js': 'Every page: "Need help now", viewport, no inline styles, home page privacy',
  'test/unit/home-summary.test.js': 'The numbers and wording on each home page',
  'test/unit/staff-links.test.js': 'Staff links, and which home page each role lands on',
  'test/unit/listener-application.test.js': 'The listener application and its checks',
  'test/unit/mood-validate.test.js': 'Mood check-in validation',
  'test/unit/pseudonym.test.js': 'Pseudonym generation',
  'test/unit/model-check-settings.test.js': 'When the model check may switch on',
  'test/unit/seed-demo-accounts.test.js': 'The demo accounts script refuses to run unless both emulators are on this computer',
};

// Finds requirement IDs such as "FR 6.2", "NFR 4" or "BR 3" in a test's
// name and the names of the groups it sits in.
function requirementIds(text) {
  const found = text.match(/\b(?:FR|NFR|BR) \d+(?:\.\d+)?\b/g) || [];
  return Array.from(new Set(found));
}

// Sorts "FR 1.4" before "FR 6.2" before "NFR 4" before "BR 3".
function compareIds(a, b) {
  const order = { FR: 0, NFR: 1, BR: 2 };
  const [aKind, aNumber] = a.split(' ');
  const [bKind, bNumber] = b.split(' ');
  if (aKind !== bKind) return order[aKind] - order[bKind];
  const aParts = aNumber.split('.').map(Number);
  const bParts = bNumber.split('.').map(Number);
  return aParts[0] - bParts[0] || (aParts[1] || 0) - (bParts[1] || 0);
}

function buildTestReport(results) {
  const ranOn = new Date(results.startTime).toISOString().slice(0, 10);
  const files = results.testResults
    .map((file) => ({
      name: path.relative(ROOT, file.name).split(path.sep).join('/'),
      tests: file.assertionResults,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const lines = [
    '# Test report',
    '',
    `A full run of Spill's automated tests on ${ranOn}: the unit tests and the Security Rules tests on the Firestore emulator (NFR 21). ` +
      'The same tests run on GitHub Actions on every push.',
    '',
    'This file is written by `npm run test:report` (`scripts/test-report.js`). Run it again to bring it up to date.',
    '',
    '## Result',
    '',
    '| | Count |',
    '|---|---|',
    `| Test files | ${results.numTotalTestSuites} |`,
    `| Tests | ${results.numTotalTests} |`,
    `| Passed | ${results.numPassedTests} |`,
    `| Failed | ${results.numFailedTests} |`,
    `| Skipped | ${results.numPendingTests} |`,
    '',
    results.success ? '**Every test passed.**' : '**Some tests failed.** They are listed at the end.',
    '',
    '## Each test file',
    '',
    '| File | What it covers | Tests | Passed |',
    '|---|---|---|---|',
  ];

  files.forEach((file) => {
    const passed = file.tests.filter((test) => test.status === 'passed').length;
    lines.push(`| \`${file.name}\` | ${FILE_NOTES[file.name] || ''} | ${file.tests.length} | ${passed} |`);
  });

  // Which requirements the tests name, and how many tests name each.
  const byRequirement = {};
  files.forEach((file) => {
    file.tests.forEach((test) => {
      const fullName = test.ancestorTitles.concat(test.title).join(' ');
      requirementIds(fullName).forEach((id) => {
        byRequirement[id] = byRequirement[id] || { tests: 0, passed: 0, files: new Set() };
        byRequirement[id].tests++;
        if (test.status === 'passed') byRequirement[id].passed++;
        byRequirement[id].files.add(path.basename(file.name));
      });
    });
  });

  lines.push(
    '',
    '## Requirements named in the tests',
    '',
    'Each row counts the tests whose name, or the name of the group they sit in, gives that requirement ID. ' +
      'Many other tests check the same requirements without naming them, so this is a floor, not the full picture.',
    '',
    '| Requirement | Tests | Passed | In |',
    '|---|---|---|---|'
  );
  Object.keys(byRequirement)
    .sort(compareIds)
    .forEach((id) => {
      const entry = byRequirement[id];
      lines.push(`| ${id} | ${entry.tests} | ${entry.passed} | ${Array.from(entry.files).sort().join(', ')} |`);
    });

  lines.push(
    '',
    '## Screening and speed',
    '',
    '- **Screening (NFR 21):** precision and recall on the labelled sets, against the goal of catching 90% of crisis and contact-sharing messages, are in [screening-report.md](screening-report.md).',
    '- **Crisis flags reach the queue within 1 minute (NFR 4):** a Security Rules test has a moderator watch the open flags live while a user sends a crisis message with its flag. ' +
      'It fails if the flag takes a minute or more, and prints the time it took. It runs on the emulator, so it shows the app adds no wait of its own, such as polling or a server step; the real network adds its own time on top.',
    '',
    '## Not covered by these tests',
    '',
    '- **Pages in a real browser.** Layout at 320, 390, 768 and 1280 px wide, "Need help now" on every page, and each role\'s walk through the app are checked in Chrome against the emulators before each release, not on every push.',
    '- **The model check service itself.** The tests cover what the app does with an answer, a broken answer and no answer. The service is never called in a test; the screening report uses its saved answers.',
    '- **The real Firebase project.** Every test runs on the emulator. The deployed site is checked by hand after each deploy.'
  );

  const failed = [];
  files.forEach((file) => {
    file.tests
      .filter((test) => test.status === 'failed')
      .forEach((test) => failed.push(`- \`${file.name}\`: ${test.ancestorTitles.concat(test.title).join(' > ')}`));
  });
  if (failed.length) {
    lines.push('', '## Failed tests', '', failed.join('\n'));
  }

  return lines.join('\n') + '\n';
}

if (require.main === module) {
  if (fs.existsSync(RESULTS_FILE)) fs.unlinkSync(RESULTS_FILE);
  spawnSync(
    'npx firebase emulators:exec --project demo-spill-dev --only firestore "jest --json --outputFile=test-results.json"',
    { cwd: ROOT, shell: true, stdio: 'inherit' }
  );
  if (!fs.existsSync(RESULTS_FILE)) {
    console.error('The tests did not finish, so there is no report. See the output above.');
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  fs.writeFileSync(REPORT_FILE, buildTestReport(results));
  console.log('Wrote ' + path.relative(process.cwd(), REPORT_FILE));
  process.exit(results.success ? 0 : 1);
}

module.exports = { buildTestReport, requirementIds, compareIds };
