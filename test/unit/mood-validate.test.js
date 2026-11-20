const fs = require('fs');
const path = require('path');
const { validateMood, tagWords, MOOD_TAGS } = require('../../public/js/mood-validate.js');

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

describe('tags (FR 3.1)', () => {
  test('accepts tags from the list, or none', () => {
    expect(validateMood({ score: 2, tags: ['rough-day', 'tired'] })).toEqual([]);
    expect(validateMood({ score: 2, tags: [] })).toEqual([]);
  });

  test('rejects a tag that is not on the list', () => {
    expect(validateMood({ score: 2, tags: ['rough-day', 'something else'] })).toEqual(['Please choose tags from the list.']);
  });

  test('rejects the same tag twice, and tags that are not a list', () => {
    expect(validateMood({ score: 2, tags: ['tired', 'tired'] }).length).toBe(1);
    expect(validateMood({ score: 2, tags: 'tired' }).length).toBe(1);
  });

  test('tagWords gives the words, leaving out unknown keys', () => {
    expect(tagWords(['money-stress', 'study-overload'])).toBe('Money stress, Study overload');
    expect(tagWords(['nope', 'lonely'])).toBe('Lonely');
    expect(tagWords(undefined)).toBe('');
  });

  const root = path.join(__dirname, '../..');

  test('firestore.rules accepts exactly the same tags', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const match = rules.match(/tags\.hasOnly\(\[([^\]]+)\]\)/);
    const ruleTags = match[1].match(/'([^']+)'/g).map((tag) => tag.slice(1, -1));
    expect(ruleTags.sort()).toEqual(Object.keys(MOOD_TAGS).sort());
    expect(rules).toMatch(new RegExp(`tags\\.size\\(\\) <= ${Object.keys(MOOD_TAGS).length}`));
  });

  test('the dashboard offers exactly the same tags, with the same words', () => {
    const html = fs.readFileSync(path.join(root, 'public/dashboard.html'), 'utf8');
    const offered = [...html.matchAll(/name="tags" value="([^"]+)"><span>([^<]+)<\/span>/g)];
    expect(offered.map((m) => m[1]).sort()).toEqual(Object.keys(MOOD_TAGS).sort());
    offered.forEach((m) => expect(m[2]).toBe(MOOD_TAGS[m[1]]));
  });
});
