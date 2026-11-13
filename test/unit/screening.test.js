const {
  screenMessage,
  normalise,
  cleanTerm,
  cleanTermList,
  applyTermChange,
  parseModelAnswer,
  modelFinding,
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

// The model check can add a finding to the term-list result. The model
// itself is never called from these tests: they cover what the app does
// with an answer, a broken answer, or no answer.
describe('model check: reading the answer', () => {
  test('a well-formed answer becomes three levels', () => {
    expect(parseModelAnswer('{"crisis":3,"abuse":0,"contact":1}')).toEqual({ crisis: 3, abuse: 0, contact: 1 });
  });

  test('levels are rounded and kept between 0 and 3', () => {
    expect(parseModelAnswer('{"crisis":7,"abuse":-2,"contact":1.6}')).toEqual({ crisis: 3, abuse: 0, contact: 2 });
  });

  test('an answer that is not JSON, or not an object, is unusable', () => {
    expect(parseModelAnswer('sorry, I cannot rate that')).toBeNull();
    expect(parseModelAnswer('')).toBeNull();
    expect(parseModelAnswer('null')).toBeNull();
    expect(parseModelAnswer('3')).toBeNull();
    expect(parseModelAnswer(undefined)).toBeNull();
  });

  test('an answer with a missing or non-number level is unusable', () => {
    expect(parseModelAnswer('{"crisis":3,"abuse":0}')).toBeNull();
    expect(parseModelAnswer('{"crisis":"3","abuse":0,"contact":0}')).toBeNull();
    expect(parseModelAnswer('{"crisis":null,"abuse":0,"contact":0}')).toBeNull();
  });
});

describe('model check: what it adds to the term-list result', () => {
  const clean = { hasCrisisLanguage: false, hasContactSharing: false, hasAbusiveLanguage: false };
  const none = { crisis: 0, abuse: 0, contact: 0 };

  test('"likely" or "clear" crisis from the model is a crisis finding', () => {
    expect(modelFinding(clean, { ...none, crisis: 2 })).toBe('crisis');
    expect(modelFinding(clean, { ...none, crisis: 3 })).toBe('crisis');
  });

  test('"likely" or "clear" abuse from the model is an abuse finding', () => {
    expect(modelFinding(clean, { ...none, abuse: 2 })).toBe('abuse');
    expect(modelFinding(clean, { ...none, abuse: 3 })).toBe('abuse');
  });

  test('"no" and "unsure" add nothing', () => {
    expect(modelFinding(clean, none)).toBe('');
    expect(modelFinding(clean, { crisis: 1, abuse: 1, contact: 1 })).toBe('');
  });

  test('crisis comes first when the model finds both', () => {
    expect(modelFinding(clean, { crisis: 3, abuse: 3, contact: 0 })).toBe('crisis');
  });

  test('nothing is added twice: what the term lists already found is not repeated', () => {
    const abuseFound = { ...clean, hasAbusiveLanguage: true };
    expect(modelFinding(abuseFound, { ...none, abuse: 3 })).toBe('');
    expect(modelFinding(abuseFound, { ...none, crisis: 3 })).toBe('crisis');

    const crisisFound = { ...clean, hasCrisisLanguage: true };
    expect(modelFinding(crisisFound, { ...none, crisis: 3 })).toBe('');
  });

  test("the model's contact level is never a finding", () => {
    expect(modelFinding(clean, { ...none, contact: 3 })).toBe('');
  });

  test('with no usable answer nothing is added', () => {
    expect(modelFinding(clean, null)).toBe('');
    expect(modelFinding(clean, undefined)).toBe('');
    expect(modelFinding(clean, {})).toBe('');
  });

  test('a message the term lists miss is a crisis finding once the model says so', () => {
    const screened = screenMessage('I keep thinking nobody needs me here');
    expect(screened.hasCrisisLanguage).toBe(false);
    expect(modelFinding(screened, parseModelAnswer('{"crisis":3,"abuse":0,"contact":0}'))).toBe('crisis');
  });

  test('the term-list result passed in is not changed', () => {
    const screened = { ...clean };
    modelFinding(screened, { crisis: 3, abuse: 3, contact: 3 });
    expect(screened).toEqual(clean);
  });
});

// FR 7.1, NFR 21: the same sets scored with the built-in lists only
// ("before") and with the terms in public/data/term-lists-seed.json added
// ("after"), as an admin would add them. Reported, not tuned: no term
// or rule is changed to make a set score better.
const SEED_TERMS = require('../../public/data/term-lists-seed.json');

// Labelled sets kept as files in test/data/. Each line is
// "label | message | language", with one label per message: crisis,
// abuse, contact or normal.
//
// - screening-held-out-2.txt: written separately from the other sets.
//   It started as held-out, but the term fixes after its first run
//   (kwipfira, seven English crisis phrases, and removing "nzakubona"
//   and "va hano") came from its misses and false positives, so it now
//   counts as TUNED, not held-out.
// - screening-held-out-3.txt: a fresh HELD-OUT set. No term or rule may
//   be added or changed because of its results.
function loadLabelledFile(fileName) {
  const text = require('fs').readFileSync(require('path').join(__dirname, '../data', fileName), 'utf8');
  return text
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const [label, message, language] = line.split(' | ').map((part) => part.trim());
      return {
        text: message,
        language,
        label,
        crisis: label === 'crisis',
        contact: label === 'contact',
        abuse: label === 'abuse',
      };
    });
}
const HELD_OUT_SET_2 = loadLabelledFile('screening-held-out-2.txt');
const HELD_OUT_SET_3 = loadLabelledFile('screening-held-out-3.txt');
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
    ['second set (tuned after the term fixes)', HELD_OUT_SET_2],
    ['third set (held-out)', HELD_OUT_SET_3],
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

// Per-language scores and every miss and false positive for one set,
// with and without the seed terms. Reported only.
function showScore(score) {
  const precision = score.truePositive + score.falsePositive === 0 ? 'n/a' : score.precision.toFixed(2);
  const recall = score.truePositive + score.falseNegative === 0 ? 'n/a' : score.recall.toFixed(2);
  return `P ${precision} R ${recall} (TP ${score.truePositive}, FP ${score.falsePositive}, FN ${score.falseNegative})`;
}

function mistakes(messages, extraTerms) {
  const lines = [];
  messages.forEach((message) => {
    const screened = screenMessage(message.text, extraTerms);
    Object.keys(CATEGORIES).forEach((category) => {
      const predicted = screened[CATEGORIES[category]];
      if (message[category] && !predicted) lines.push(`  MISS ${category} [${message.language}] ${message.text}`);
      if (!message[category] && predicted) lines.push(`  FALSE POSITIVE ${category} (labelled ${message.label}) [${message.language}] ${message.text}`);
    });
  });
  return lines.length ? lines.join('\n') : '  none';
}

function detailReport(title, messages) {
  const lines = [title];
  [['before (built-in lists only)', undefined], ['after (seed terms added)', SEED_TERMS]].forEach(([name, extraTerms]) => {
    lines.push(name);
    ['kinyarwanda', 'english', 'mixed'].forEach((language) => {
      const subset = messages.filter((message) => message.language === language);
      const scores = scoreSet(subset, extraTerms);
      Object.keys(CATEGORIES).forEach((category) => {
        lines.push(`  ${language.padEnd(11)} ${category.padEnd(8)} ${showScore(scores[category])}`);
      });
    });
    lines.push(mistakes(messages, extraTerms));
  });
  return lines.join('\n');
}

function isWellFormed(message) {
  return ['crisis', 'abuse', 'contact', 'normal'].includes(message.label) &&
    ['kinyarwanda', 'english', 'mixed'].includes(message.language);
}

// Since the term fixes, the second set's numbers are on a tuned set,
// not a held-out one.
describe('second set in detail, tuned after the term fixes (NFR 21)', () => {
  test('the set loads as expected', () => {
    expect(HELD_OUT_SET_2.length).toBe(47);
    expect(HELD_OUT_SET_2.every(isWellFormed)).toBe(true);
  });

  test('per language, and every miss and false positive, before and after', () => {
    const report = detailReport('second set (tuned)', HELD_OUT_SET_2);
    console.log(report);
    expect(report).toContain('after (seed terms added)');
  });
});

// The third set is held-out: reported as it is, never used to change
// terms or rules.
describe('third set in detail, held-out (NFR 21)', () => {
  test('the set loads as expected', () => {
    expect(HELD_OUT_SET_3.length).toBe(42);
    expect(HELD_OUT_SET_3.every(isWellFormed)).toBe(true);
  });

  test('per language, and every miss and false positive, before and after', () => {
    const report = detailReport('third set (held-out)', HELD_OUT_SET_3);
    console.log(report);
    expect(report).toContain('after (seed terms added)');
  });
});

// Term fixes after the second set's first run (FR 7.1).
describe('term fixes: new crisis terms and removed abuse terms', () => {
  test.each([
    ['kwipfira', 'Ndumva nshaka kwipfira'],
    ['point in going on', 'there is no point in going on like this'],
    ['better off without me', 'my family would be better off without me'],
    ['end it all', 'I want to end it all tonight'],
    ['ending it all', 'I keep thinking about ending it all'],
    ['disappear forever', 'I wish I could disappear forever'],
    ['never wake up', 'I hope I never wake up'],
    ['life has no worth', 'my life has no worth'],
  ])('the new crisis term "%s" is caught', (term, message) => {
    expect(SEED_TERMS.crisis).toContain(term);
    expect(screenMessage(message, SEED_TERMS).hasCrisisLanguage).toBe(true);
    expect(screenMessage(message).hasCrisisLanguage).toBe(false);
  });

  test.each([
    "I don't see the point in going on anymore.",
    "I've been thinking about ending it all.",
  ])('the second set\'s English crisis message "%s" is now flagged as crisis', (message) => {
    expect(screenMessage(message, SEED_TERMS).hasCrisisLanguage).toBe(true);
  });

  test('"nzakubona ejo" and "kuva hano" are not flagged', () => {
    expect(SEED_TERMS.abuse).not.toContain('nzakubona');
    expect(SEED_TERMS.abuse).not.toContain('va hano');
    ['Nzakubona ejo', 'Kuva hano ni kure'].forEach((message) => {
      const screened = screenMessage(message, SEED_TERMS);
      expect(screened.hasAbusiveLanguage).toBe(false);
      expect(screened.hasCrisisLanguage).toBe(false);
      expect(screened.hasContactSharing).toBe(false);
    });
  });
});

// The "Import starter terms" button on admin-terms.html (FR 7.1). The
// import may only ever add terms, and must skip what is already there.
describe('planStarterTermImport (admin import of the starter terms)', () => {
  const { planStarterTermImport, MAX_TERM_LENGTH } = require('../../public/js/screening.js');

  test('adds every starter term to an empty list, cleaned', () => {
    const plan = planStarterTermImport('crisis', [], ['  Fade Away Forever ', 'Nta mpamvu yo kubaho']);
    expect(plan.terms).toEqual(['fade away forever', 'nta mpamvu yo kubaho']);
    expect(plan.added).toEqual(['fade away forever', 'nta mpamvu yo kubaho']);
    expect(plan.skipped).toBe(0);
  });

  test('skips a term that is already on the list and keeps the list in order', () => {
    const plan = planStarterTermImport('abuse', ['one term', 'two term'], ['two term', 'three term']);
    expect(plan.terms).toEqual(['one term', 'two term', 'three term']);
    expect(plan.added).toEqual(['three term']);
    expect(plan.skipped).toBe(1);
  });

  test('never removes or changes a term the admin added', () => {
    const existing = ['an admin term', 'another admin term'];
    const plan = planStarterTermImport('contact', existing, ['a starter term']);
    expect(plan.terms.slice(0, 2)).toEqual(existing);
  });

  test('skips a term that is already built in', () => {
    const builtIn = DEFAULT_TERM_LISTS.crisis[0];
    const plan = planStarterTermImport('crisis', [], [builtIn, 'fade away forever']);
    expect(plan.added).toEqual(['fade away forever']);
    expect(plan.skipped).toBe(1);
  });

  test('skips the same starter term given twice', () => {
    const plan = planStarterTermImport('crisis', [], ['fade away forever', 'Fade away forever!']);
    expect(plan.added).toEqual(['fade away forever']);
    expect(plan.skipped).toBe(1);
  });

  test('skips a term that is too short or too long', () => {
    const plan = planStarterTermImport('abuse', [], ['ab', 'x'.repeat(MAX_TERM_LENGTH + 1), 'good term']);
    expect(plan.added).toEqual(['good term']);
    expect(plan.skipped).toBe(2);
  });

  test('stops adding when the list is full', () => {
    const full = distinctTerms(MAX_TERMS_PER_LIST - 1);
    const plan = planStarterTermImport('contact', full, ['fits in', 'does not fit']);
    expect(plan.terms.length).toBe(MAX_TERMS_PER_LIST);
    expect(plan.added).toEqual(['fits in']);
    expect(plan.skipped).toBe(1);
  });

  test('a second import adds nothing', () => {
    const starter = ['first term', 'second term'];
    const first = planStarterTermImport('crisis', [], starter);
    const second = planStarterTermImport('crisis', first.terms, starter);
    expect(second.added).toEqual([]);
    expect(second.skipped).toBe(2);
    expect(second.terms).toEqual(first.terms);
  });

  test('a missing or broken starter list adds nothing', () => {
    expect(planStarterTermImport('crisis', ['kept term'], undefined)).toEqual({ terms: ['kept term'], added: [], skipped: 0 });
    expect(planStarterTermImport('crisis', ['kept term'], 'not a list').added).toEqual([]);
  });

  test.each(['crisis', 'abuse', 'contact'])('every real starter %s term can be imported into an empty list', (category) => {
    const plan = planStarterTermImport(category, [], SEED_TERMS[category]);
    expect(plan.added.length).toBe(SEED_TERMS[category].length);
    expect(plan.skipped).toBe(0);
    expect(plan.terms.length).toBeLessThanOrEqual(MAX_TERMS_PER_LIST);
  });
});
