const { staffLinksFor } = require('../../public/js/staff-links.js');

function hrefs(role, hasListenerRecord) {
  return staffLinksFor(role, hasListenerRecord).map((link) => link.href);
}

describe('staffLinksFor', () => {
  test('an ordinary user gets no staff links', () => {
    expect(hrefs('user', false)).toEqual([]);
  });

  test('someone who applied as a listener gets the listener pages', () => {
    expect(hrefs('user', true)).toEqual(['listener-dashboard.html', 'listener-training.html']);
  });

  test('a moderator gets the queue and no admin pages', () => {
    expect(hrefs('moderator', false)).toEqual(['moderator-queue.html']);
  });

  test('an admin gets the admin pages and not the moderator queue', () => {
    expect(hrefs('admin', false)).toEqual([
      'admin-listeners.html',
      'admin-terms.html',
      'admin-resources.html',
    ]);
  });

  test('an unknown or missing role gets nothing', () => {
    expect(hrefs('superuser', false)).toEqual([]);
    expect(hrefs(undefined, false)).toEqual([]);
  });

  test('every link has a label to show', () => {
    staffLinksFor('admin', true).forEach((link) => {
      expect(link.label.length).toBeGreaterThan(0);
    });
  });
});
