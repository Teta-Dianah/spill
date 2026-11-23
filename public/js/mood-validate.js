// Checks a mood check-in before it gets saved (FR 3.1).
// Kept separate from the Firebase-calling code in mood.js so it is easy
// to unit test without needing Firestore at all.

var MAX_NOTE_LENGTH = 280;

// The optional tags a check-in can carry (FR 3.1), in Spill's own calm
// words. The key is what gets saved; firestore.rules accepts only these
// keys, so keep the two lists the same.
var MOOD_TAGS = {
  'rough-day': 'Rough day',
  'money-stress': 'Money stress',
  'study-overload': 'Study overload',
  family: 'Family',
  friends: 'Friends',
  lonely: 'Lonely',
  tired: 'Tired',
  'good-news': 'Good news',
};

function validateMood(entry) {
  var errors = [];

  var score = entry.score;
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    errors.push('Please choose how today is going, from 1 to 5.');
  }

  if (entry.note && entry.note.length > MAX_NOTE_LENGTH) {
    errors.push('Your note is a bit long. Please keep it under 280 characters.');
  }

  if (entry.tags !== undefined) {
    var tagsOk = Array.isArray(entry.tags) && entry.tags.every(function (tag, index) {
      return Object.prototype.hasOwnProperty.call(MOOD_TAGS, tag) && entry.tags.indexOf(tag) === index;
    });
    if (!tagsOk) errors.push('Please choose tags from the list.');
  }

  return errors; // an empty array means the entry is valid
}

// The words for a list of tag keys, such as "Rough day, Tired". Unknown
// keys are left out.
function tagWords(tags) {
  if (!Array.isArray(tags)) return '';
  return tags
    .filter(function (tag) {
      return Object.prototype.hasOwnProperty.call(MOOD_TAGS, tag);
    })
    .map(function (tag) {
      return MOOD_TAGS[tag];
    })
    .join(', ');
}

if (typeof module !== 'undefined') {
  module.exports = { validateMood, tagWords, MAX_NOTE_LENGTH, MOOD_TAGS };
}
