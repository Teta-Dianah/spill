// Checks on the written screening report (NFR 21) and the way it works
// out each set-up's findings.
const fs = require('fs');
const { buildScreeningReport, findings, REPORT_FILE } = require('../../scripts/screening-report.js');
const { SETS } = require('../screening-sets.js');
const MODEL_ANSWERS = require('../data/model-check-answers.json');

// Git can change line endings on Windows, so compare without them.
const sameText = (text) => text.replace(/\r\n/g, '\n');

describe('the screening report (NFR 21)', () => {
  test('docs/screening-report.md matches the code: run "npm run report:screening" if this fails', () => {
    expect(sameText(fs.readFileSync(REPORT_FILE, 'utf8'))).toBe(sameText(buildScreeningReport()));
  });

  test('it reports precision and recall on a held-out set of at least 40 labelled messages', () => {
    const heldOut = SETS.filter((set) => set.heldOut);
    expect(heldOut.length).toBeGreaterThanOrEqual(1);
    heldOut.forEach((set) => expect(set.messages.length).toBeGreaterThanOrEqual(40));

    const report = buildScreeningReport();
    expect(report).toContain('Caught');
    expect(report).toContain('precision');
    expect(report).toContain('90% goal');
  });

  test('there is a saved model answer for every test message, so no row is quietly missing the model', () => {
    SETS.forEach((set) => {
      set.messages.forEach((message) => {
        expect(MODEL_ANSWERS.answers).toHaveProperty([message.text]);
      });
    });
  });

  test('the saved answers hold only levels from 0 to 3, or no answer', () => {
    Object.values(MODEL_ANSWERS.answers).forEach((answer) => {
      if (answer === null) return;
      ['crisis', 'abuse', 'contact'].forEach((name) => {
        expect([0, 1, 2, 3]).toContain(answer[name]);
      });
    });
  });
});

describe('findings: each set-up worked out the way the chat page does it', () => {
  test('each set-up only ever adds to the one before', () => {
    const lost = [];
    SETS.forEach((set) => {
      set.messages.forEach((message) => {
        const lists = findings(message.text, 'lists');
        const starter = findings(message.text, 'starter');
        const model = findings(message.text, 'model');
        ['crisis', 'contact', 'abuse'].forEach((category) => {
          if (lists[category] && !starter[category]) lost.push(`starter terms lost ${category}: ${message.text}`);
          if (starter[category] && !model[category]) lost.push(`model check lost ${category}: ${message.text}`);
        });
      });
    });
    expect(lost).toEqual([]);
  });

  test('the model never adds contact-sharing', () => {
    SETS.forEach((set) => {
      set.messages.forEach((message) => {
        expect(findings(message.text, 'model').contact).toBe(findings(message.text, 'starter').contact);
      });
    });
  });

  test('a message blocked for contact details, or already flagged as crisis, gets nothing from the model', () => {
    // chat.js never sends these to the model, so only the lists count.
    const notAsked = SETS.flatMap((set) => set.messages).filter((message) => {
      const starter = findings(message.text, 'starter');
      return starter.contact || starter.crisis;
    });
    expect(notAsked.length).toBeGreaterThan(0);
    notAsked.forEach((message) => {
      expect(findings(message.text, 'model')).toEqual(findings(message.text, 'starter'));
    });
  });
});
