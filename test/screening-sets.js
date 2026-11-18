// The labelled sample messages for the screening checks (NFR 21), and
// the scoring used on them. Shared by test/unit/screening.test.js and
// scripts/screening-report.js, so the tests and the written report always
// score the same sets in the same way.

const { screenMessage } = require('../public/js/screening.js');

// Labelled sample messages for NFR 21 (at least 40, precision and recall
// reported). Each message says what it SHOULD be flagged as (crisis,
// contact-sharing, abuse), so we can score the screener against real
// expectations, not just check it runs.
const LABELLED_MESSAGES = [
  // Crisis: positive cases
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
  // block below): firestore.rules always rejects the contact details,
  // so the message itself is never delivered, but the crisis flag and
  // card still need to happen.
  { text: 'I want to kill myself, call me at 0788123456', crisis: true, contact: true, abuse: false },

  // Contact-sharing: positive cases
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

  // Abuse: positive cases
  { text: 'you are an idiot', crisis: false, contact: false, abuse: true },
  { text: "that's so stupid", crisis: false, contact: false, abuse: true },
  { text: 'just shut up', crisis: false, contact: false, abuse: true },
  { text: 'I hate you so much', crisis: false, contact: false, abuse: true },
  { text: 'I could kill you', crisis: false, contact: false, abuse: true },

  // Clean: true negatives for every category
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

// A held-out set, never used while writing the term lists or patterns
// above. Some are English phrased differently from anything in the term
// list; some are Kinyarwanda or mixed Kinyarwanda/English. The point is
// to see how the screener actually generalises, not to tune it until
// this set passes too: the SRS already documents English-only term
// lists as a known limitation (section 2.5, Design and Implementation
// Constraints), and this set measures exactly that gap honestly instead
// of asserting it away.
const HELD_OUT_MESSAGES = [
  // Kinyarwanda crisis language: expected to be missed: the crisis term
  // list only has English phrases, so there is nothing for these to
  // match against.
  { text: 'Ndashaka kwiyahura', crisis: true, contact: false, abuse: false, note: 'Kinyarwanda: "I want to kill myself"' },
  { text: 'Nta mpamvu yo kubaho', crisis: true, contact: false, abuse: false, note: 'Kinyarwanda: "there is no reason to live"' },
  { text: 'Ndumva nshaka gupfa buri munsi', crisis: true, contact: false, abuse: false, note: 'Kinyarwanda: "I feel like I want to die every day"' },
  { text: "I feel like ndashaka kwiyahura, I can't take it anymore", crisis: true, contact: false, abuse: false, note: 'mixed Kinyarwanda/English' },
  { text: 'Nibyiza ko nagiye, sinzongera kubaho', crisis: true, contact: false, abuse: false, note: 'Kinyarwanda: "better that I\'m gone, I won\'t live anymore"' },

  // English crisis language, reworded away from anything in the term
  // list: tests whether phrase-matching generalises within English too.
  { text: "I can't go on anymore, everything feels pointless", crisis: true, contact: false, abuse: false },
  { text: "honestly? i don't want to be alive anymore", crisis: true, contact: false, abuse: false },
  { text: 'sometimes I just want to disappear, I think about suicide a lot', crisis: true, contact: false, abuse: false, note: 'contains "suicide" verbatim, so this one should still hit' },

  // Clean Kinyarwanda: checking we don't false-positive just because
  // the text isn't English.
  { text: 'Amakuru ki? Ndumva neza uyu munsi', crisis: false, contact: false, abuse: false, note: 'Kinyarwanda: "what\'s new? I\'m feeling fine today"' },
  { text: "Narushye cyane n'ibizamini", crisis: false, contact: false, abuse: false, note: 'Kinyarwanda: "I\'m very tired from exams"' },

  // Contact-sharing in Kinyarwanda/mixed text: this is pattern-based
  // (phone numbers, platform names), not term-list based, so it should
  // generalise across languages much better than crisis/abuse do.
  { text: 'Mpamagara kuri 0788123456', crisis: false, contact: true, abuse: false, note: 'Kinyarwanda: "call me at 0788123456"' },
  { text: 'Reba kuri whatsapp yanjye', crisis: false, contact: true, abuse: false, note: 'Kinyarwanda: "check my whatsapp"' },
  { text: 'Twaganire kuri telegram', crisis: false, contact: true, abuse: false, note: 'Kinyarwanda: "let\'s talk on telegram"' },
  { text: 'Urashobora kumbwira kuri +250788123456?', crisis: false, contact: true, abuse: false, note: 'mixed Kinyarwanda/English, phone number' },

  // Abuse: Kinyarwanda and reworded English, both expected to miss.
  { text: 'Uri igicucu, ndakwanga', crisis: false, contact: false, abuse: true, note: 'Kinyarwanda insult + "I hate you"' },
  { text: "You're an absolute waste of space, nobody likes you", crisis: false, contact: false, abuse: true, note: 'English, reworded away from the term list' },
];

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
  const text = require('fs').readFileSync(require('path').join(__dirname, 'data', fileName), 'utf8');
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

// Every set, in the order the report shows them. heldOut marks the one
// set the report's held-out results come from: held out, and at least 40
// messages (NFR 21). heldOutText is what the report's table says.
const SETS = [
  { name: 'First set', file: 'in test/screening-sets.js', heldOut: false, heldOutText: 'No', messages: LABELLED_MESSAGES,
    about: 'Used while writing the built-in term lists and patterns.' },
  { name: 'Small early set', file: 'in test/screening-sets.js', heldOut: false, heldOutText: 'Yes, but small', messages: HELD_OUT_MESSAGES,
    about: 'Written after the first set, mostly Kinyarwanda and reworded English. No term or rule was changed to improve its score, but it has only 16 messages, so the held-out results below come from the third set.' },
  { name: 'Second set', file: 'test/data/screening-held-out-2.txt', heldOut: false, heldOutText: 'No, tuned', messages: HELD_OUT_SET_2,
    about: 'Written separately. Held out for its first run only: some starter terms were then fixed because of its misses, so it now counts as tuned.' },
  { name: 'Third set', file: 'test/data/screening-held-out-3.txt', heldOut: true, heldOutText: 'Yes', messages: HELD_OUT_SET_3,
    about: 'Held out. Run once, after the term fixes. No term or rule has been changed because of it.' },
];

module.exports = {
  LABELLED_MESSAGES,
  HELD_OUT_MESSAGES,
  HELD_OUT_SET_2,
  HELD_OUT_SET_3,
  CATEGORIES,
  SETS,
  scoreCategory,
  scoreSet,
};
