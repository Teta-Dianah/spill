const fs = require('fs');
const path = require('path');
const { isOldFinishedChat, CHAT_KEEP_DAYS } = require('../../public/js/old-chats.js');

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 20, 12, 0, 0);

describe('isOldFinishedChat (NFR 13)', () => {
  test('chats are kept for 90 days', () => {
    expect(CHAT_KEEP_DAYS).toBe(90);
  });

  test('an ended chat started 91 days ago goes', () => {
    expect(isOldFinishedChat({ status: 'ended', createdAtMs: now - 91 * DAY }, now)).toBe(true);
  });

  test('declined and cancelled requests go too', () => {
    expect(isOldFinishedChat({ status: 'declined', createdAtMs: now - 91 * DAY }, now)).toBe(true);
    expect(isOldFinishedChat({ status: 'cancelled', createdAtMs: now - 91 * DAY }, now)).toBe(true);
  });

  test('an ended chat started 89 days ago stays', () => {
    expect(isOldFinishedChat({ status: 'ended', createdAtMs: now - 89 * DAY }, now)).toBe(false);
  });

  test('a chat still going or waiting stays, however old', () => {
    expect(isOldFinishedChat({ status: 'active', createdAtMs: now - 300 * DAY }, now)).toBe(false);
    expect(isOldFinishedChat({ status: 'pending', createdAtMs: now - 300 * DAY }, now)).toBe(false);
  });

  test('a chat with no start time stays', () => {
    expect(isOldFinishedChat({ status: 'ended', createdAtMs: 0 }, now)).toBe(false);
  });
});

describe('the clean-up runs from both dashboards', () => {
  const root = path.join(__dirname, '../..');
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

  test.each([
    ['public/dashboard.html', 'public/js/dashboard.js', "removeOldChats(user.uid, 'userId')"],
    ['public/listener-dashboard.html', 'public/js/listener-dashboard.js', "removeOldChats(user.uid, 'listenerId')"],
  ])('%s loads old-chats.js and calls it', (page, script, call) => {
    expect(read(page)).toContain('<script src="js/old-chats.js"></script>');
    expect(read(script)).toContain(call);
  });

  test('the rules use the same 90 days', () => {
    expect(read('firestore.rules')).toContain(`duration.value(${CHAT_KEEP_DAYS}, 'd')`);
  });
});
