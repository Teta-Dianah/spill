const fs = require('fs');
const path = require('path');
const { isIdleTooLong, IDLE_LIMIT_MS } = require('../../public/js/idle-signout.js');

const MINUTE = 60 * 1000;

describe('isIdleTooLong (FR 1.4)', () => {
  const now = Date.UTC(2026, 10, 20, 12, 0, 0);

  test('the limit is 30 minutes', () => {
    expect(IDLE_LIMIT_MS).toBe(30 * MINUTE);
  });

  test('active a minute ago: stays signed in', () => {
    expect(isIdleTooLong(now - MINUTE, now)).toBe(false);
  });

  test('exactly 30 minutes: stays signed in', () => {
    expect(isIdleTooLong(now - 30 * MINUTE, now)).toBe(false);
  });

  test('31 minutes away: signed out', () => {
    expect(isIdleTooLong(now - 31 * MINUTE, now)).toBe(true);
  });

  test('a page opened the next day: signed out', () => {
    expect(isIdleTooLong(now - 24 * 60 * MINUTE, now)).toBe(true);
  });

  test('no record of any activity: stays signed in', () => {
    expect(isIdleTooLong(0, now)).toBe(false);
    expect(isIdleTooLong(null, now)).toBe(false);
  });
});

describe('every page that signs people in loads the idle sign-out', () => {
  const publicDir = path.join(__dirname, '../../public');
  const pages = fs.readdirSync(publicDir).filter((name) => name.endsWith('.html'));
  const firebasePages = pages.filter((name) =>
    fs.readFileSync(path.join(publicDir, name), 'utf8').includes('<script src="js/firebase-init.js"></script>')
  );

  test('there are pages to check', () => {
    expect(firebasePages.length).toBeGreaterThan(10);
  });

  test.each(firebasePages)('%s loads idle-signout.js right after firebase-init.js', (page) => {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    expect(html).toMatch(/<script src="js\/firebase-init\.js"><\/script>\r?\n\s*<script src="js\/idle-signout\.js"><\/script>/);
  });
});
