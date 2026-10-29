const { screenMessage, normalise } = require('../../public/js/screening.js');

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
