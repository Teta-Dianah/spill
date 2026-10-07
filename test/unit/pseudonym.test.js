const { generatePseudonym } = require('../../public/js/pseudonym.js');

test('returns a non-empty string', () => {
  const name = generatePseudonym();
  expect(typeof name).toBe('string');
  expect(name.length).toBeGreaterThan(0);
});

test('never contains spaces', () => {
  const name = generatePseudonym();
  expect(name).not.toMatch(/\s/);
});

test('ends with a number', () => {
  const name = generatePseudonym();
  expect(name).toMatch(/[0-9]+$/);
});

test('is not always the same name', () => {
  const names = new Set();
  for (let i = 0; i < 20; i += 1) {
    names.add(generatePseudonym());
  }
  expect(names.size).toBeGreaterThan(1);
});
