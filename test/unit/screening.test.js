const {
  screenMessage,
  normalise,
  cleanTerm,
  cleanTermList,
  applyTermChange,
  DEFAULT_TERM_LISTS,
  MAX_TERMS_PER_LIST,
} = require('../../public/js/screening.js');

// Labelled sample messages for NFR 21 (at least 40, precision and recall
// reported). Each message says what it SHOULD be flagged as — crisis,
// contact-sharing, abuse — so we can score the screener against real
// expectations, not just check it runs.
const LABELLED_MESSAGES = [
  // Crisis — positive cases
  { text: 'I want to kill myself', crisis: true, contact: false, abuse: false },
  { text: 'sometimes I think about ending my life', crisis: true, contact: false, abuse: false },
  { text: "I don't want to be here anymore, thinking about suicide", crisis: true, contact: false, abuse: false },
  { text: "I've been hurting myself again", crisis: true, contact: false, abuse: false },
  { text: 'there is no reason to live anymore', crisis: true, contact: false, abuse: false },
  { text: 'I am suicidal right now', crisis: true, contact: false, abuse: false },
  { text: 'I just want to die', crisis: true, contact: false, abuse: false },
  { text: 'I keep thinking about self harm', crisis: true, contact: false, abuse: false },
  { text: 'SUICIDE is all I think about', crisis: true, contact: false, abuse: false },
  { text: 'i wanna d1e', crisis: true, contact: false, abuse: false },

  // Combined: crisis wording and contact-sharing in the same message.
  // chat.js must still catch both at once (see the dedicated describe
  // block below) — firestore.rules always rejects the contact details,
  // so the message itself is never delivered, but the crisis flag and
  // card still need to happen.
  { text: 'I want to kill myself, call me at 0788123456', crisis: true, contact: true, abuse: false },

  // Contact-sharing — positive cases
  { text: 'call me at 0788123456', crisis: false, contact: true, abuse: false },
  { text: 'my email is test@example.com', crisis: false, contact: true, abuse: false },
  { text: 'check out https://example.com', crisis: false, contact: true, abuse: false },
  { text: 'find me on instagram: myhandle', crisis: false, contact: true, abuse: false },
  { text: 'whatsapp me later', crisis: false, contact: true, abuse: false },
  { text: "let's move this to telegram", crisis: false, contact: true, abuse: false },
  { text: 'text me 123-456-7890', crisis: false, contact: true, abuse: false },
  { text: 'www.example.com has more info', crisis: false, contact: true, abuse: false },
  { text: 'message me on snap: userxyz', crisis: false, contact: true, abuse: false },
  { text: "here's my number +250788123456", crisis: false, contact: true, abuse: false },

  // Abuse — positive cases
  { text: 'you are an idiot', crisis: false, contact: false, abuse: true },
  { text: "that's so stupid", crisis: false, contact: false, abuse: true },
  { text: 'just shut up', crisis: false, contact: false, abuse: true },
  { text: 'I hate you so much', crisis: false, contact: false, abuse: true },
  { text: 'I could kill you', crisis: false, contact: false, abuse: true },

  // Clean — true negatives for every category
  { text: 'Hi, how are you today?', crisis: false, contact: false, abuse: false },
  { text: 'I had a rough exam today', crisis: false, contact: false, abuse: false },
  { text: 'Money stress has been hard lately', crisis: false, contact: false, abuse: false },
  { text: 'Can we talk about my family situation?', crisis: false, contact: false, abuse: false },
  { text: 'Thank you so much for listening', crisis: false, contact: false, abuse: false },
  { text: 'I feel a bit better now', crisis: false, contact: false, abuse: false },
  { text: 'What time is it where you are?', crisis: false, contact: false, abuse: false },
  { text: "I've been feeling really down about school", crisis: false, contact: false, abuse: false },
  { text: 'My friends keep their numbers private', crisis: false, contact: false, abuse: false },
  { text: 'I love talking to you here', crisis: false, contact: false, abuse: false },
  { text: 'Loneliness has been tough this week', crisis: false, contact: false, abuse: false },
  { text: "I'm grateful for this chat", crisis: false, contact: false, abuse: false },
  { text: 'Can you recommend self-help tips?', crisis: false, contact: false, abuse: false },
  { text: "I don't feel like doing anything today", crisis: false, contact: false, abuse: false },
  { text: 'That movie was killer!', crisis: false, contact: false, abuse: false },
  { text: "I'm really stressed about exams this week", crisis: false, contact: false, abuse: false },
  { text: "My friend's birthday is tomorrow", crisis: false, contact: false, abuse: false },
  { text: 'This app helps me feel less alone', crisis: false, contact: false, abuse: false },
  { text: 'I appreciate you being here for me', crisis: false, contact: false, abuse: false },
  { text: "Let's talk about something else", crisis: false, contact: false, abuse: false },
];

function scoreCategory(messages, expectedKey, predicate) {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  messages.forEach((message) => {
    const expected = message[expectedKey];
    const predicted = predicate(message.text);

    if (expected && predicted) truePositive += 1;
    if (!expected && predicted) falsePositive += 1;
    if (expected && !predicted) falseNegative += 1;
  });

  const precision = truePositive + falsePositive === 0 ? 1 : truePositive / (truePositive + falsePositive);
  const recall = truePositive + falseNegative === 0 ? 1 : truePositive / (truePositive + falseNegative);

  return { truePositive, falsePositive, falseNegative, precision, recall };
}

describe('screenMessage against labelled sample messages (NFR 21)', () => {
  test('the sample set has at least 40 labelled messages', () => {
    expect(LABELLED_MESSAGES.length).toBeGreaterThanOrEqual(40);
  });

  test('crisis language: precision and recall', () => {
    const score = scoreCategory(LABELLED_MESSAGES, 'crisis', (text) => screenMessage(text).hasCrisisLanguage);
    console.log('Crisis language —', score);
    expect(score.recall).toBeGreaterThanOrEqual(0.9);
    expect(score.precision).toBeGreaterThanOrEqual(0.9);
  });

  test('contact-sharing: precision and recall', () => {
    const score = scoreCategory(LABELLED_MESSAGES, 'contact', (text) => screenMessage(text).hasContactSharing);
    console.log('Contact-sharing —', score);
    expect(score.recall).toBeGreaterThanOrEqual(0.9);
    expect(score.precision).toBeGreaterThanOrEqual(0.9);
  });

  test('abusive language: precision and recall', () => {
    const score = scoreCategory(LABELLED_MESSAGES, 'abuse', (text) => screenMessage(text).hasAbusiveLanguage);
    console.log('Abusive language —', score);
    expect(score.recall).toBeGreaterThanOrEqual(0.9);
    expect(score.precision).toBeGreaterThanOrEqual(0.9);
  });
});

// A message can contain both crisis wording and contact details at
// once. chat.js's screenAndSendMessage() routes on hasContactSharing
// first, so the message is always rejected — but it must still notice
// the crisis wording too, so sendBlockedAttempt() knows to raise a
// crisis flag and show the crisis card alongside the blocked-attempt
// flag (FR 6.2, FR 6.3; see the matching Rules test in
// test/rules/firestore.test.js for the actual write behaviour).
describe('screenMessage on a combined crisis + contact-sharing message', () => {
  test('both hasCrisisLanguage and hasContactSharing are true at once', () => {
    const screened = screenMessage('I want to kill myself, call me at 0788123456');
    expect(screened.hasCrisisLanguage).toBe(true);
    expect(screened.hasContactSharing).toBe(true);
  });
});

// A held-out set, never used while writing the term lists or patterns
// above. Some are English phrased differently from anything in the term
// list; some are Kinyarwanda or mixed Kinyarwanda/English. The point is
// to see how the screener actually generalises, not to tune it until
// this set passes too — the SRS already documents English-only term
// lists as a known limitation (section 2.5, Design and Implementation
// Constraints), and this set measures exactly that gap honestly instead
// of asserting it away.
const HELD_OUT_MESSAGES = [
  // Kinyarwanda crisis language — expected to be missed: the crisis term
  // list only has English phrases, so there is nothing for these to
  // match against.
  { text: 'Ndashaka kwiyahura', crisis: true, contact: false, abuse: false, note: 'Kinyarwanda: "I want to kill myself"' },
  { text: 'Nta mpamvu yo kubaho', crisis: true, contact: false, abuse: false, note: 'Kinyarwanda: "there is no reason to live"' },
  { text: 'Ndumva nshaka gupfa buri munsi', crisis: true, contact: false, abuse: false, note: 'Kinyarwanda: "I feel like I want to die every day"' },
  { text: "I feel like ndashaka kwiyahura, I can't take it anymore", crisis: true, contact: false, abuse: false, note: 'mixed Kinyarwanda/English' },
  { text: 'Nibyiza ko nagiye, sinzongera kubaho', crisis: true, contact: false, abuse: false, note: 'Kinyarwanda: "better that I\'m gone, I won\'t live anymore"' },

  // English crisis language, reworded away from anything in the term
  // list — tests whether phrase-matching generalises within English too.
  { text: "I can't go on anymore, everything feels pointless", crisis: true, contact: false, abuse: false },
  { text: "honestly? i don't want to be alive anymore", crisis: true, contact: false, abuse: false },
  { text: 'sometimes I just want to disappear, I think about suicide a lot', crisis: true, contact: false, abuse: false, note: 'contains "suicide" verbatim, so this one should still hit' },

  // Clean Kinyarwanda — checking we don't false-positive just because
  // the text isn't English.
  { text: 'Amakuru ki? Ndumva neza uyu munsi', crisis: false, contact: false, abuse: false, note: 'Kinyarwanda: "what\'s new? I\'m feeling fine today"' },
  { text: "Narushye cyane n'ibizamini", crisis: false, contact: false, abuse: false, note: 'Kinyarwanda: "I\'m very tired from exams"' },

  // Contact-sharing in Kinyarwanda/mixed text — this is pattern-based
  // (phone numbers, platform names), not term-list based, so it should
  // generalise across languages much better than crisis/abuse do.
  { text: 'Mpamagara kuri 0788123456', crisis: false, contact: true, abuse: false, note: 'Kinyarwanda: "call me at 0788123456"' },
  { text: 'Reba kuri whatsapp yanjye', crisis: false, contact: true, abuse: false, note: 'Kinyarwanda: "check my whatsapp"' },
  { text: 'Twaganire kuri telegram', crisis: false, contact: true, abuse: false, note: 'Kinyarwanda: "let\'s talk on telegram"' },
  { text: 'Urashobora kumbwira kuri +250788123456?', crisis: false, contact: true, abuse: false, note: 'mixed Kinyarwanda/English, phone number' },

  // Abuse — Kinyarwanda and reworded English, both expected to miss.
  { text: 'Uri igicucu, ndakwanga', crisis: false, contact: false, abuse: true, note: 'Kinyarwanda insult + "I hate you"' },
  { text: "You're an absolute waste of space, nobody likes you", crisis: false, contact: false, abuse: true, note: 'English, reworded away from the term list' },
];

describe('screenMessage against a held-out set (not tuned against)', () => {
  test('the held-out set has at least 15 messages', () => {
    expect(HELD_OUT_MESSAGES.length).toBeGreaterThanOrEqual(15);
  });

  test('crisis language on held-out messages (expect a real drop, especially on Kinyarwanda)', () => {
    const score = scoreCategory(HELD_OUT_MESSAGES, 'crisis', (text) => screenMessage(text).hasCrisisLanguage);
    console.log('Held-out crisis language —', score);
    expect(score.recall).toBeGreaterThanOrEqual(0);
  });

  test('contact-sharing on held-out messages (pattern-based, should generalise better)', () => {
    const score = scoreCategory(HELD_OUT_MESSAGES, 'contact', (text) => screenMessage(text).hasContactSharing);
    console.log('Held-out contact-sharing —', score);
    expect(score.recall).toBeGreaterThanOrEqual(0);
  });

  test('abusive language on held-out messages (expect a real drop)', () => {
    const score = scoreCategory(HELD_OUT_MESSAGES, 'abuse', (text) => screenMessage(text).hasAbusiveLanguage);
    console.log('Held-out abusive language —', score);
    expect(score.recall).toBeGreaterThanOrEqual(0);
  });
});

describe('normalise', () => {
  test('lower-cases and collapses repeated letters', () => {
    expect(normalise('HEEEELP')).toBe('heelp');
  });

  test('applies common number substitutions', () => {
    expect(normalise('h3lp m3')).toBe('help me');
  });

  test('strips punctuation', () => {
    expect(normalise("Hi, how's it going?!")).toBe('hi hows it going');
  });
});

// FR 7.1: terms an admin adds through admin-terms.html, stored in
// Firestore and passed to screenMessage() as its second argument.
// Makes n different terms using letters only. normalise() turns digits
// into letters and collapses repeats, so "term 1" style names could end
// up as duplicates of each other.
function distinctTerms(n) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const terms = [];
  for (let i = 0; i < n; i++) {
    terms.push('term ' + letters[Math.floor(i / 26) % 26] + letters[i % 26]);
  }
  return terms;
}

describe('admin-added terms (FR 7.1)', () => {
  test('a crisis term added through the lists is caught', () => {
    const extra = { crisis: ['fade away forever'] };
    expect(screenMessage('some days I just want to fade away forever', extra).hasCrisisLanguage).toBe(true);
    expect(screenMessage('some days I just want to fade away forever').hasCrisisLanguage).toBe(false);
  });

  test('an abuse term and a contact phrase added through the lists are caught', () => {
    const extra = { abuse: ['useless clown'], contact: ['find me outside'] };
    expect(screenMessage('you useless clown', extra).hasAbusiveLanguage).toBe(true);
    expect(screenMessage('find me outside after school', extra).hasContactSharing).toBe(true);
  });

  test('matching ignores capitals and accents, like messages', () => {
    const extra = { crisis: ['Fade Away Forever'] };
    expect(screenMessage('I want to FÄDE away forever', extra).hasCrisisLanguage).toBe(true);
  });

  test('admin terms add to the built-in lists, never replace them', () => {
    const extra = { crisis: ['fade away forever'], contact: ['find me outside'] };
    expect(screenMessage('I want to kill myself', extra).hasCrisisLanguage).toBe(true);
    expect(screenMessage('call me at 0788123456', extra).hasContactSharing).toBe(true);
    expect(screenMessage('whatsapp me later', extra).hasContactSharing).toBe(true);
  });

  test('missing, empty or broken lists fall back to the built-in terms', () => {
    [null, {}, { crisis: [] }, { crisis: 'not a list' }, { crisis: [42, null] }].forEach((extra) => {
      expect(screenMessage('I want to kill myself', extra).hasCrisisLanguage).toBe(true);
      expect(screenMessage('Hi, how are you today?', extra).hasCrisisLanguage).toBe(false);
    });
  });

  test('terms are plain text, never a regex', () => {
    expect(cleanTerm('.*')).toBe('');
    const extra = { abuse: ['bad|word'] };
    expect(screenMessage('that was bad', extra).hasAbusiveLanguage).toBe(false);
    expect(screenMessage('that was bad word', extra).hasAbusiveLanguage).toBe(true);
  });

  test('terms that are too short or too long are ignored', () => {
    expect(cleanTerm('hi')).toBe('');
    expect(cleanTerm('a'.repeat(61))).toBe('');
    expect(screenMessage('hi there', { abuse: ['hi'] }).hasAbusiveLanguage).toBe(false);
  });

  test('a saved list is capped and de-duplicated when loaded', () => {
    expect(cleanTermList(distinctTerms(MAX_TERMS_PER_LIST + 50)).length).toBe(MAX_TERMS_PER_LIST);
    expect(cleanTermList(['Same Term', 'same term', 'SAME TERM!'])).toEqual(['same term']);
  });
});

describe('applyTermChange (admin add, edit, remove)', () => {
  test('adds a cleaned term', () => {
    expect(applyTermChange('crisis', [], 'add', null, '  Fade Away Forever ')).toEqual({ terms: ['fade away forever'] });
  });

  test('edits a term in place', () => {
    const result = applyTermChange('abuse', ['one term', 'two term'], 'edit', 'one term', 'new term');
    expect(result).toEqual({ terms: ['new term', 'two term'] });
  });

  test('removes a term', () => {
    expect(applyTermChange('abuse', ['one term', 'two term'], 'remove', 'one term')).toEqual({ terms: ['two term'] });
  });

  test('refuses a duplicate, including a built-in term', () => {
    expect(applyTermChange('abuse', ['one term'], 'add', null, 'ONE TERM').error).toBeDefined();
    expect(applyTermChange('crisis', [], 'add', null, DEFAULT_TERM_LISTS.crisis[0]).error).toBeDefined();
  });

  test('refuses a term that is too short or too long', () => {
    expect(applyTermChange('abuse', [], 'add', null, 'hi').error).toBeDefined();
    expect(applyTermChange('abuse', [], 'add', null, 'a'.repeat(61)).error).toBeDefined();
  });

  test('refuses to add once the list is full', () => {
    const full = distinctTerms(MAX_TERMS_PER_LIST);
    expect(applyTermChange('abuse', full, 'add', null, 'one more').error).toBeDefined();
  });

  test('refuses to edit or remove a term that is no longer there', () => {
    expect(applyTermChange('abuse', [], 'remove', 'gone term').error).toBeDefined();
    expect(applyTermChange('abuse', [], 'edit', 'gone term', 'new term').error).toBeDefined();
  });
});

// FR 7.1, NFR 21: the same sets scored with the built-in lists only
// ("before") and with the terms in scripts/term-lists-seed.json added
// ("after"), as an admin would add them. Reported, not tuned: no term
// or rule is changed to make a set score better.
const SEED_TERMS = require('../../scripts/term-lists-seed.json');
const CATEGORIES = { crisis: 'hasCrisisLanguage', contact: 'hasContactSharing', abuse: 'hasAbusiveLanguage' };

function scoreSet(messages, extraTerms) {
  const scores = {};
  Object.keys(CATEGORIES).forEach((category) => {
    scores[category] = scoreCategory(messages, category, (text) => screenMessage(text, extraTerms)[CATEGORIES[category]]);
  });
  return scores;
}

function formatScores(name, before, after) {
  const lines = [name];
  Object.keys(CATEGORIES).forEach((category) => {
    const b = before[category];
    const a = after[category];
    lines.push(
      `  ${category.padEnd(8)} precision ${b.precision.toFixed(2)} -> ${a.precision.toFixed(2)}, ` +
      `recall ${b.recall.toFixed(2)} -> ${a.recall.toFixed(2)} ` +
      `(TP ${b.truePositive}->${a.truePositive}, FP ${b.falsePositive}->${a.falsePositive}, FN ${b.falseNegative}->${a.falseNegative})`
    );
  });
  return lines.join('\n');
}

describe('before and after adding the seed terms (FR 7.1, NFR 21)', () => {
  const SETS = [
    ['tuned set', LABELLED_MESSAGES],
    ['previous held-out set', HELD_OUT_MESSAGES],
  ];

  test.each(SETS)('%s: precision and recall before and after', (name, messages) => {
    const before = scoreSet(messages);
    const after = scoreSet(messages, SEED_TERMS);
    console.log(formatScores(name, before, after));

    // Seed terms only ever add to the built-in lists, so nothing caught
    // before can be missed after.
    Object.keys(CATEGORIES).forEach((category) => {
      expect(after[category].truePositive).toBeGreaterThanOrEqual(before[category].truePositive);
    });
  });

  test('every seed term is valid and is caught when sent on its own', () => {
    Object.keys(CATEGORIES).forEach((category) => {
      SEED_TERMS[category].forEach((term) => {
        expect(cleanTerm(term)).not.toBe('');
        expect(screenMessage(term, SEED_TERMS)[CATEGORIES[category]]).toBe(true);
      });
    });
  });
});
