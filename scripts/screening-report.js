// Writes docs/screening-report.md: how well message screening catches
// crisis language, contact-sharing and abusive language on the labelled
// test sets (NFR 21), against the SRS goal of catching at least 90% of
// crisis and contact-sharing messages in a test set.
//
// Every number in the report is worked out here, never typed by hand. A
// unit test checks the saved report still matches what this script
// writes, so the report can't fall behind the code.
//
// It needs no network and no emulator. The model check's answers come
// from test/data/model-check-answers.json, saved once from the same model
// and instructions the app uses, so the service is never called here.
//
// Usage: npm run report:screening

const fs = require('fs');
const path = require('path');
const { screenMessage, modelFinding } = require('../public/js/screening.js');
const { SETS, CATEGORIES, scoreCategory } = require('../test/screening-sets.js');
const SEED_TERMS = require('../public/data/term-lists-seed.json');
const MODEL_ANSWERS = require('../test/data/model-check-answers.json');

const REPORT_FILE = path.join(__dirname, '..', 'docs', 'screening-report.md');
const GOAL = 0.9;

// The three set-ups the report compares.
const SETUPS = [
  { key: 'lists', name: 'Built-in lists only' },
  { key: 'starter', name: 'With the starter terms' },
  { key: 'model', name: 'With the model check too' },
];

const CATEGORY_NAMES = { crisis: 'Crisis language', contact: 'Contact-sharing', abuse: 'Abusive language' };

// What one set-up finds in one message, worked out the same way the chat
// page does it (chat.js, screenAndSendMessage):
// - a message with contact details is blocked and never sent to the
//   model, and neither is one the lists already flag as crisis;
// - any other message is sent, then the model can add one crisis or
//   abuse finding (modelFinding). It never adds contact-sharing.
function findings(text, setupKey) {
  const screened = setupKey === 'lists' ? screenMessage(text) : screenMessage(text, SEED_TERMS);
  const result = {
    crisis: screened.hasCrisisLanguage,
    contact: screened.hasContactSharing,
    abuse: screened.hasAbusiveLanguage,
  };

  if (setupKey === 'model' && !screened.hasContactSharing && !screened.hasCrisisLanguage) {
    const added = modelFinding(screened, MODEL_ANSWERS.answers[text]);
    if (added) result[added] = true;
  }
  return result;
}

function score(messages, category, setupKey) {
  return scoreCategory(messages, category, (text) => findings(text, setupKey)[category]);
}

function percent(fraction) {
  return Math.round(fraction * 100) + '%';
}

// "13 of 15 (87%)", or a dash when the set has none of that kind.
function caughtText(result) {
  const total = result.truePositive + result.falseNegative;
  if (total === 0) return '–';
  return `${result.truePositive} of ${total} (${percent(result.recall)})`;
}

// "0", or "2 (precision 75%)" when there were false alarms.
function falseAlarmText(result) {
  if (result.falsePositive === 0) return '0';
  return `${result.falsePositive} (precision ${percent(result.precision)})`;
}

function goalText(category, result) {
  if (category === 'abuse') return 'no goal set';
  if (result.truePositive + result.falseNegative === 0) return '–';
  return result.recall >= GOAL ? 'met' : 'not met';
}

function countLabels(messages) {
  const counts = { crisis: 0, contact: 0, abuse: 0, normal: 0 };
  messages.forEach((message) => {
    let any = false;
    Object.keys(CATEGORIES).forEach((category) => {
      if (message[category]) {
        counts[category]++;
        any = true;
      }
    });
    if (!any) counts.normal++;
  });
  return counts;
}

function setsSection() {
  const lines = [
    '## The test sets',
    '',
    'All messages are made up for testing. None came from a real person.',
    '',
    '| Set | Messages | Crisis | Contact | Abuse | Neither | Held out? | Where |',
    '|---|---|---|---|---|---|---|---|',
  ];
  SETS.forEach((set) => {
    const counts = countLabels(set.messages);
    lines.push(
      `| ${set.name} | ${set.messages.length} | ${counts.crisis} | ${counts.contact} | ${counts.abuse} | ${counts.normal} | ` +
      `${set.heldOutText} | ${set.file} |`
    );
  });
  lines.push('');
  SETS.forEach((set) => lines.push(`- **${set.name}:** ${set.about}`));
  lines.push('');
  lines.push(
    'A message can have more than one label: one message in the first set has both crisis wording and a phone number. ' +
    'Only a held-out set shows how screening does on wording nobody tuned it for. The others show that the terms do what they were added for.'
  );
  return lines.join('\n');
}

function categorySection(category) {
  const lines = [
    `## ${CATEGORY_NAMES[category]}`,
    '',
    '| Set | Set-up | Caught | False alarms | 90% goal |',
    '|---|---|---|---|---|',
  ];
  SETS.forEach((set) => {
    SETUPS.forEach((setup) => {
      // The model never adds contact-sharing, so that row would only
      // repeat the one above it.
      if (category === 'contact' && setup.key === 'model') return;
      const result = score(set.messages, category, setup.key);
      lines.push(
        `| ${set.name}${set.heldOut ? ' (held out)' : ''} | ${setup.name} | ${caughtText(result)} | ` +
        `${falseAlarmText(result)} | ${goalText(category, result)} |`
      );
    });
  });
  if (category === 'contact') {
    lines.push('');
    lines.push('The model check is not shown here, because it never adds a contact-sharing finding. Blocking a message is left to the term lists, the patterns and `firestore.rules`.');
  }
  return lines.join('\n');
}

function languageSection() {
  const heldOut = SETS.find((set) => set.heldOut);
  const lines = [
    '## By language, on the held-out set',
    '',
    `How each set-up does on the ${heldOut.name.toLowerCase()} for messages in each language.`,
    '',
    '| Language | Kind | Messages | Built-in lists only | With the starter terms | With the model check too |',
    '|---|---|---|---|---|---|',
  ];
  ['english', 'kinyarwanda', 'mixed'].forEach((language) => {
    const subset = heldOut.messages.filter((message) => message.language === language);
    Object.keys(CATEGORIES).forEach((category) => {
      const total = subset.filter((message) => message[category]).length;
      if (total === 0) return;
      const cells = SETUPS.map((setup) => {
        if (category === 'contact' && setup.key === 'model') return 'same as starter terms';
        return caughtText(score(subset, category, setup.key));
      });
      const languageName = language === 'mixed' ? 'Mixed' : language[0].toUpperCase() + language.slice(1);
      lines.push(`| ${languageName} | ${CATEGORY_NAMES[category]} | ${total} | ${cells.join(' | ')} |`);
    });
  });
  return lines.join('\n');
}

// Which part of the full set-up flagged a message: the built-in lists,
// the starter terms, or the model check.
function flaggedBy(text, category) {
  if (findings(text, 'lists')[category]) return 'the built-in lists';
  if (findings(text, 'starter')[category]) return 'the starter terms';
  return 'the model check';
}

// Every message the full set-up still gets wrong on the held-out set.
function heldOutMistakes() {
  const heldOut = SETS.find((set) => set.heldOut);
  const misses = [];
  const falseAlarms = [];
  heldOut.messages.forEach((message) => {
    const found = findings(message.text, 'model');
    Object.keys(CATEGORIES).forEach((category) => {
      const mistake = { category, text: message.text, language: message.language, label: message.label };
      if (message[category] && !found[category]) misses.push(mistake);
      if (!message[category] && found[category]) {
        mistake.flaggedBy = flaggedBy(message.text, category);
        falseAlarms.push(mistake);
      }
    });
  });
  return { misses, falseAlarms };
}

function mistakesSection() {
  const { misses, falseAlarms } = heldOutMistakes();
  const missLines = misses.map((m) => `- ${CATEGORY_NAMES[m.category].toLowerCase()} (${m.language}): "${m.text}"`);
  const alarmLines = falseAlarms.map(
    (m) => `- ${CATEGORY_NAMES[m.category].toLowerCase()} (${m.language}): "${m.text}" (labelled ${m.label}, flagged by ${m.flaggedBy})`
  );

  return [
    '## What the full set-up still gets wrong on the held-out set',
    '',
    'With the starter terms and the model check together:',
    '',
    '**Missed**',
    '',
    missLines.length ? missLines.join('\n') : 'Nothing.',
    '',
    '**False alarms**',
    '',
    alarmLines.length ? alarmLines.join('\n') : 'None.',
    '',
    'No term or rule is changed because of this list, since that would stop this set being held out. ' +
    'Any fix needs a new set, written after the fix, to show whether it works.',
  ].join('\n');
}

function summarySection() {
  const heldOut = SETS.find((set) => set.heldOut);
  const result = (category, setupKey) => score(heldOut.messages, category, setupKey);
  const line = (category, setupKey) => {
    const r = result(category, setupKey);
    return `${caughtText(r)}, goal ${goalText(category, r)}`;
  };

  const { misses, falseAlarms } = heldOutMistakes();
  const notes = [
    `Without the model check, the term lists catch ${caughtText(result('crisis', 'starter'))} of the crisis messages: ` +
      'they only find a phrase written the way it was listed, and most of these messages are reworded or informal.',
    `With the model check added, which reads what a message means, screening catches ${caughtText(result('crisis', 'model'))}.`,
  ];

  const contactMisses = misses.filter((m) => m.category === 'contact');
  const contact = result('contact', 'model');
  if (contactMisses.length) {
    notes.push(
      `Contact-sharing: ${caughtText(contact)}, goal ${goalText('contact', contact)}. ` +
      `The model check can't help here, because it never blocks a message. The messages missed: ` +
      contactMisses.map((m) => `"${m.text}"`).join(', ') + '.'
    );
  }

  falseAlarms.forEach((m) => {
    notes.push(
      `False alarm: "${m.text}" was flagged as ${CATEGORY_NAMES[m.category].toLowerCase()} by ${m.flaggedBy}, though it is an everyday message.`
    );
  });

  notes.push('The sets are small and were written by the developer, so these numbers show where the gaps are, not a rate to expect with real users.');

  return [
    '## Summary',
    '',
    `On the ${heldOut.name.toLowerCase()}: held out, and large enough (${heldOut.messages.length} messages) for the NFR 21 bar of 40:`,
    '',
    '| | Crisis language | Contact-sharing |',
    '|---|---|---|',
    `| Built-in lists only | ${line('crisis', 'lists')} | ${line('contact', 'lists')} |`,
    `| With the starter terms | ${line('crisis', 'starter')} | ${line('contact', 'starter')} |`,
    `| With the model check too | ${line('crisis', 'model')} | ${line('contact', 'model')} |`,
    '',
    notes.map((note) => '- ' + note).join('\n'),
  ].join('\n');
}

function buildScreeningReport() {
  return [
    '# Screening report (NFR 21)',
    '',
    'How well Spill\'s message screening catches crisis language, contact-sharing and abusive language on labelled test messages. ' +
    'The SRS sets two numbers to meet: **precision and recall reported on at least 40 labelled messages** (NFR 21), and a pilot goal of ' +
    '**catching at least 90% of crisis language and of contact-sharing in a test set**.',
    '',
    'This file is written by `npm run report:screening` (`scripts/screening-report.js`). Do not edit it by hand: ' +
    'a unit test fails if it no longer matches what the script writes.',
    '',
    '## How to read the numbers',
    '',
    '- **Caught** is recall: of the messages that should have been flagged, how many were. This is the number the 90% goal is about.',
    '- **False alarms** are messages flagged that should not have been. Precision is the share of flags that were right.',
    '- Every message is checked for all three kinds, so a normal message flagged as crisis counts as a crisis false alarm.',
    '',
    'Three set-ups are compared, each adding to the one before:',
    '',
    '1. **Built-in lists only:** the term lists and patterns in `public/js/screening.js`.',
    '2. **With the starter terms:** plus the terms in `public/data/term-lists-seed.json`, which an admin adds with "Import starter terms".',
    `3. **With the model check too:** plus the model check (Google Gemini, \`${MODEL_ANSWERS.model}\`), worked out the way the chat page does it. ` +
      'A message blocked for contact-sharing or already flagged as crisis is not sent to the model, and the model can only add one crisis or abuse finding, at level 2 or 3. ' +
      `Its answers were saved on ${MODEL_ANSWERS.answeredOn} with the same instructions as \`public/js/model-check.js\` (\`test/data/model-check-answers.json\`).`,
    '',
    'The model check is a demo prototype that runs only in the development project, and only for people who agreed to it (see the README). ' +
    'Everyone else gets set-up 2 once the starter terms are imported, or set-up 1 before then. ' +
    '`firestore.rules` has its own small, fixed patterns as a backstop, which `test/rules/firestore.test.js` tests separately; they are not scored here.',
    '',
    summarySection(),
    '',
    setsSection(),
    '',
    categorySection('crisis'),
    '',
    categorySection('contact'),
    '',
    categorySection('abuse'),
    '',
    languageSection(),
    '',
    mistakesSection(),
    '',
  ].join('\n');
}

if (require.main === module) {
  fs.writeFileSync(REPORT_FILE, buildScreeningReport());
  console.log('Wrote ' + path.relative(process.cwd(), REPORT_FILE));
}

module.exports = { buildScreeningReport, findings, REPORT_FILE };
