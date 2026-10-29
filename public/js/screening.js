// Message screening (FR 6.1-6.4). No Firebase in this file, so it is
// easy to unit test on its own.
//
// This is the richer, admin-editable half of screening (FR 7.1 lets an
// admin edit the term lists without redeploying). firestore.rules has
// its own smaller, fixed set of the same core patterns, hardcoded and
// not editable from the admin pages — that is the actual safety
// backstop, enforced at write time no matter what this file does. See
// the comment at the top of firestore.rules for why the two are split
// this way.

var DEFAULT_TERM_LISTS = {
  crisis: [
    'kill myself', 'kill me', 'end my life', 'ending my life',
    'want to die', 'wanna die', 'suicide', 'suicidal',
    'self harm', 'hurt myself', 'hurting myself',
    'no reason to live', 'not worth living',
  ],
  abuse: [
    'idiot', 'stupid', 'shut up', 'hate you', 'kill you',
  ],
};

// Lower-cases, strips accents, collapses repeated letters ("heeeelp" ->
// "heelp") and common number/symbol substitutions ("h3lp" -> "help"), so
// a term list of plain phrases still catches common ways people dodge
// simple filters.
function normalise(text) {
  var result = text.toLowerCase();
  result = result.normalize('NFD').replace(/[̀-ͯ]/g, '');
  result = result
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
  result = result.replace(/(.)\1{2,}/g, '$1$1');
  result = result.replace(/['’]/g, ''); // drop apostrophes: "don't" -> "dont"
  result = result.replace(/[^a-z0-9\s]/g, ' '); // other punctuation -> space
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

function containsAnyTerm(normalisedText, terms) {
  return terms.some(function (term) {
    return normalisedText.indexOf(term) !== -1;
  });
}

// Contact-sharing doesn't fit a fixed phrase list, so this is pattern
// based instead: phone numbers, emails, links, social handles, and
// common ways of asking to move off the platform.
var PHONE_PATTERN = /(\+?\d[\d\s-]{6,}\d)/;
var EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
var URL_PATTERN = /(https?:\/\/|www\.)\S+/i;
// Naming the platform at all is enough to flag — being specific about
// which handle follows it isn't necessary and was missing real cases
// like "whatsapp me later".
var HANDLE_PATTERN = /\b(instagram|insta|whatsapp|snapchat|snap|telegram)\b/i;
var AT_HANDLE_PATTERN = /@[a-z0-9._]{3,}/i;
var MOVE_OFF_PATTERN = /(text me|call me|message me on|let's move (this|to)|off (this|the) (app|platform))/i;

function hasContactSharing(rawText) {
  return (
    PHONE_PATTERN.test(rawText) ||
    EMAIL_PATTERN.test(rawText) ||
    URL_PATTERN.test(rawText) ||
    HANDLE_PATTERN.test(rawText) ||
    AT_HANDLE_PATTERN.test(rawText) ||
    MOVE_OFF_PATTERN.test(rawText)
  );
}

// FR 6.1: normalise and check a message against the term lists before
// delivery. termLists defaults to the built-in list, but the live app
// passes in whatever the admin has saved in Firestore (FR 7.1).
function screenMessage(text, termLists) {
  var lists = termLists || DEFAULT_TERM_LISTS;
  var normalised = normalise(text);

  return {
    hasCrisisLanguage: containsAnyTerm(normalised, lists.crisis),
    hasContactSharing: hasContactSharing(text),
    hasAbusiveLanguage: containsAnyTerm(normalised, lists.abuse),
  };
}

if (typeof module !== 'undefined') {
  module.exports = { screenMessage: screenMessage, normalise: normalise, DEFAULT_TERM_LISTS: DEFAULT_TERM_LISTS };
}
