const { validateMood } = require('../../public/js/mood-validate.js');

test('accepts a score from 1 to 5 with no note', () => {
  expect(validateMood({ score: 3 })).toEqual([]);
});

test('rejects a score of 0', () => {
  expect(validateMood({ score: 0 }).length).toBeGreaterThan(0);
});

test('rejects a score of 6', () => {
  expect(validateMood({ score: 6 }).length).toBeGreaterThan(0);
});

test('rejects a non-whole-number score', () => {
  expect(validateMood({ score: 2.5 }).length).toBeGreaterThan(0);
});

test('accepts a short note', () => {
  expect(validateMood({ score: 4, note: 'Rough day' })).toEqual([]);
});

test('rejects a note over 280 characters', () => {
  const longNote = 'a'.repeat(281);
  expect(validateMood({ score: 4, note: longNote }).length).toBeGreaterThan(0);
});
