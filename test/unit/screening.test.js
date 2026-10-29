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
