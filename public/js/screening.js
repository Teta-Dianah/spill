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

// The model check (model-check.js) rates a message with a level for
// crisis, abuse and contact: 0 no, 1 unsure, 2 likely, 3 clear. A level
// of 2 or 3 counts as a finding. This cut-off was fixed before the model
// was tested, not chosen from its results.
var MODEL_FLAG_LEVEL = 2;
var MODEL_LEVEL_NAMES = ['crisis', 'abuse', 'contact'];

// Turns the model's answer (JSON text) into { crisis, abuse, contact }
// levels from 0 to 3. Returns null if the answer can't be used, so a
// broken answer is treated the same as no answer at all.
function parseModelAnswer(answerText) {
  var parsed;
  try {
    parsed = JSON.parse(answerText);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  var levels = {};
  for (var i = 0; i < MODEL_LEVEL_NAMES.length; i++) {
    var level = parsed[MODEL_LEVEL_NAMES[i]];
    if (typeof level !== 'number' || !isFinite(level)) return null;
    levels[MODEL_LEVEL_NAMES[i]] = Math.max(0, Math.min(3, Math.round(level)));
  }
  return levels;
}

// Works out what the model check adds to the term-list result from
// screenMessage(): 'crisis', 'abuse', or '' for nothing new.
//
// The model can only ADD a crisis or abuse finding, never remove one,
// and with no usable answer (levels is null) it adds nothing. If it
// finds both, crisis comes first. Its contact level isn't used here:
// contact-sharing blocks a message, and that is left to the term lists
// and patterns.
function modelFinding(screened, levels) {
  if (!levels) return '';

  if (levels.crisis >= MODEL_FLAG_LEVEL && !screened.hasCrisisLanguage) return 'crisis';
  if (levels.abuse >= MODEL_FLAG_LEVEL && !screened.hasAbusiveLanguage) return 'abuse';
  return '';
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

// A moderator can suggest a term for these lists only (FR 7.1). Contact
// terms block a message outright, so they stay with the admin.
var SUGGESTION_CATEGORIES = ['crisis', 'abuse'];
var MAX_SUGGESTION_NOTE_LENGTH = 280;

// Checks a moderator's suggestion before it is saved. Returns
// { phrase, category, note } with the phrase cleaned the same way as a
// term on a list, or { error: 'message' } if it isn't allowed.
function checkTermSuggestion(category, phrase, note) {
  if (SUGGESTION_CATEGORIES.indexOf(category) === -1) {
    return { error: 'Choose crisis or abusive language.' };
  }
  var cleaned = cleanTerm(phrase);
  if (!cleaned) {
    return { error: 'Phrases need to be between ' + MIN_TERM_LENGTH + ' and ' + MAX_TERM_LENGTH + ' characters.' };
  }
  if (DEFAULT_TERM_LISTS[category].indexOf(cleaned) !== -1) {
    return { error: 'That phrase is already built in.' };
  }
  var cleanedNote = typeof note === 'string' ? note.trim() : '';
  if (cleanedNote.length > MAX_SUGGESTION_NOTE_LENGTH) {
    return { error: 'Notes can be up to ' + MAX_SUGGESTION_NOTE_LENGTH + ' characters.' };
  }
  return { phrase: cleaned, category: category, note: cleanedNote };
}

// Things an admin should think about before approving a suggested
// phrase. A term matches anywhere in a message, even inside a longer
// word, so a short phrase or a single word can flag harmless messages.
// Returns a list of warnings to show (empty if there are none).
function termSuggestionWarnings(phrase) {
  var cleaned = cleanTerm(phrase);
  var warnings = [];
  if (!cleaned) return warnings;

  if (cleaned.length < 6) {
    warnings.push('it is under 6 characters, so it may match inside ordinary words.');
  }
  if (cleaned.indexOf(' ') === -1) {
    warnings.push('it is a single word. Matching ignores word breaks, so it also matches inside longer words and in harmless messages.');
  }
  return warnings;
}

// Works out what importing the starter terms would do to one list,
// without touching Firebase, so it can be unit tested. Each starter term
// goes through applyTermChange as an ordinary 'add', so the import can
// only add terms, never change or remove one, and a term the admin page
// would refuse (already listed, too short, list full) is skipped.
// Returns { terms: newList, added: [terms added], skipped: howMany }.
function planStarterTermImport(category, currentTerms, starterTerms) {
  var terms = cleanTermList(currentTerms);
  var added = [];
  var skipped = 0;

  (Array.isArray(starterTerms) ? starterTerms : []).forEach(function (term) {
    var result = applyTermChange(category, terms, 'add', null, term);
    if (result.error) {
      skipped++;
      return;
    }
    terms = result.terms;
    added.push(terms[terms.length - 1]);
  });

  return { terms: terms, added: added, skipped: skipped };
}

if (typeof module !== 'undefined') {
  module.exports = {
    screenMessage: screenMessage,
    normalise: normalise,
    cleanTerm: cleanTerm,
    cleanTermList: cleanTermList,
    applyTermChange: applyTermChange,
    planStarterTermImport: planStarterTermImport,
    checkTermSuggestion: checkTermSuggestion,
    termSuggestionWarnings: termSuggestionWarnings,
    SUGGESTION_CATEGORIES: SUGGESTION_CATEGORIES,
    MAX_SUGGESTION_NOTE_LENGTH: MAX_SUGGESTION_NOTE_LENGTH,
    parseModelAnswer: parseModelAnswer,
    modelFinding: modelFinding,
    DEFAULT_TERM_LISTS: DEFAULT_TERM_LISTS,
    MAX_TERM_LENGTH: MAX_TERM_LENGTH,
    MAX_TERMS_PER_LIST: MAX_TERMS_PER_LIST,
  };
}
