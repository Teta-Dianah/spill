// Message screening (FR 6.1-6.4). No Firebase in this file, so it is
// easy to unit test on its own.
//
// This is the richer, admin-editable half of screening (FR 7.1 lets an
// admin add terms without redeploying). firestore.rules has
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
  // Contact-sharing is mostly caught by the fixed patterns further down
  // (phone numbers, emails, links, platform names). This list is only
  // for extra phrases an admin adds, such as a Kinyarwanda "call me".
  contact: [],
};

// Limits on admin-added terms (FR 7.1). A very short term would match
// inside almost every message, so terms must be at least 3 characters.
var MIN_TERM_LENGTH = 3;
var MAX_TERM_LENGTH = 60;
var MAX_TERMS_PER_LIST = 200;

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

// Turns an admin-entered term into the form it is matched in: the same
// normalise() used on messages (lower case, no accents, no punctuation).
// Terms are plain text only. They are matched with indexOf, never turned
// into a regex, so "a|b" or ".*" have no special meaning. Returns ''
// for anything that isn't a usable term (not text, too short, too long).
function cleanTerm(term) {
  if (typeof term !== 'string') return '';
  var cleaned = normalise(term);
  if (cleaned.length < MIN_TERM_LENGTH || cleaned.length > MAX_TERM_LENGTH) return '';
  return cleaned;
}

// Cleans a list of admin-added terms, dropping unusable ones and
// duplicates, and keeping at most MAX_TERMS_PER_LIST. Used on every
// list read from Firestore, so a bad value saved there can never break
// screening.
function cleanTermList(terms) {
  var result = [];
  if (!Array.isArray(terms)) return result;
  terms.forEach(function (term) {
    var cleaned = cleanTerm(term);
    if (cleaned && result.indexOf(cleaned) === -1 && result.length < MAX_TERMS_PER_LIST) {
      result.push(cleaned);
    }
  });
  return result;
}

// The built-in terms plus any admin-added extras. Admin terms only ever
// add to the built-in lists, never replace them, so the browser always
// catches at least what firestore.rules checks for.
function combinedTerms(category, extraTerms) {
  var extras = extraTerms ? cleanTermList(extraTerms[category]) : [];
  return DEFAULT_TERM_LISTS[category].concat(extras);
}

// FR 6.1: normalise and check a message against the term lists before
// delivery. extraTerms is optional: { crisis: [...], abuse: [...],
// contact: [...] } as saved by an admin in Firestore (FR 7.1).
function screenMessage(text, extraTerms) {
  var normalised = normalise(text);

  return {
    hasCrisisLanguage: containsAnyTerm(normalised, combinedTerms('crisis', extraTerms)),
    hasContactSharing: hasContactSharing(text) ||
      containsAnyTerm(normalised, combinedTerms('contact', extraTerms)),
    hasAbusiveLanguage: containsAnyTerm(normalised, combinedTerms('abuse', extraTerms)),
  };
}

// Works out an admin's add, edit or remove on one term list (FR 7.1),
// without touching Firebase, so it can be unit tested. Returns
// { terms: newList } on success, or { error: 'message' } if the change
// isn't allowed. For 'edit', oldTerm is replaced by newTerm.
function applyTermChange(category, currentTerms, action, oldTerm, newTerm) {
  var terms = cleanTermList(currentTerms);
  var index = terms.indexOf(oldTerm);

  if (action === 'remove' || action === 'edit') {
    if (index === -1) return { error: "That term isn't on the list any more." };
    terms.splice(index, 1);
    if (action === 'remove') return { terms: terms };
  }

  var cleaned = cleanTerm(newTerm);
  if (!cleaned) {
    return { error: 'Terms need to be between ' + MIN_TERM_LENGTH + ' and ' + MAX_TERM_LENGTH + ' characters.' };
  }
  if (terms.indexOf(cleaned) !== -1 || DEFAULT_TERM_LISTS[category].indexOf(cleaned) !== -1) {
    return { error: 'That term is already on the list.' };
  }
  if (terms.length >= MAX_TERMS_PER_LIST) {
    return { error: 'This list is full. Remove a term before adding another.' };
  }

  if (action === 'edit') {
    terms.splice(index, 0, cleaned);
  } else {
    terms.push(cleaned);
  }
  return { terms: terms };
}

if (typeof module !== 'undefined') {
  module.exports = {
    screenMessage: screenMessage,
    normalise: normalise,
    cleanTerm: cleanTerm,
    cleanTermList: cleanTermList,
    applyTermChange: applyTermChange,
    DEFAULT_TERM_LISTS: DEFAULT_TERM_LISTS,
    MAX_TERM_LENGTH: MAX_TERM_LENGTH,
    MAX_TERMS_PER_LIST: MAX_TERMS_PER_LIST,
  };
}
