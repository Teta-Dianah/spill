// Builds a random display name for a new account, so nobody has to use
// their real name anywhere in Spill (FR 1.2, NFR 11).
// This file has no Firebase in it, so it is easy to unit test on its own.

var ADJECTIVES = [
  'Calm', 'Bright', 'Gentle', 'Quiet', 'Brave', 'Kind',
  'Steady', 'Warm', 'Patient', 'Hopeful',
];

var NOUNS = [
  'River', 'Maple', 'Sky', 'Harbor', 'Meadow',
  'Ember', 'Cloud', 'Stone', 'Breeze', 'Willow',
];

function generatePseudonym() {
  var adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  var noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  var number = Math.floor(Math.random() * 100); // 0-99, keeps names short
  return adjective + noun + number;
}

// This guard only matters for our Jest tests, which run in Node.
// A browser loading this as a plain <script> tag has no `module` object,
// so it skips this line and just keeps generatePseudonym as a global function.
if (typeof module !== 'undefined') {
  module.exports = { generatePseudonym };
}
