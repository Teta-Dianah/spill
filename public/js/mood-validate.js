// Checks a mood check-in before it gets saved (FR 3.1).
// Kept separate from the Firebase-calling code in mood.js so it is easy
// to unit test without needing Firestore at all.

var MAX_NOTE_LENGTH = 280;

function validateMood(entry) {
  var errors = [];

  var score = entry.score;
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    errors.push('Please choose how today is going, from 1 to 5.');
  }

  if (entry.note && entry.note.length > MAX_NOTE_LENGTH) {
    errors.push('Your note is a bit long. Please keep it under 280 characters.');
  }

  return errors; // an empty array means the entry is valid
}

if (typeof module !== 'undefined') {
  module.exports = { validateMood, MAX_NOTE_LENGTH };
}
