const { staffLinksFor, homePageFor } = require('../../public/js/staff-links.js');

function hrefs(role, isApprovedListener) {
  return staffLinksFor(role, isApprovedListener).map((link) => link.href);
}

describe('staffLinksFor', () => {
  test('an ordinary user gets no staff links', () => {
    expect(hrefs('user', false)).toEqual([]);
  });

  test('an approved listener gets the listener pages', () => {
    expect(hrefs('user', true)).toEqual(['listener-dashboard.html', 'listener-training.html']);
  });

  test('a moderator gets the queue and no admin pages', () => {
    expect(hrefs('moderator', false)).toEqual(['staff.html', 'moderator-queue.html']);
  });

  test('an admin gets the admin pages and not the moderator queue', () => {
    expect(hrefs('admin', false)).toEqual([
      'staff.html',
      'admin-listeners.html',
      'admin-terms.html',
      'admin-resources.html',
      'stats.html',
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

describe('homePageFor (where sign-in sends each person)', () => {
  test('an ordinary user goes to their dashboard', () => {
    expect(homePageFor('user', false)).toBe('dashboard.html');
  });

  test('an approved listener goes to the listener dashboard', () => {
    expect(homePageFor('user', true)).toBe('listener-dashboard.html');
  });

  test('someone who has only applied to be a listener still goes to their dashboard', () => {
    expect(homePageFor('user', false)).toBe('dashboard.html');
  });

  test('a moderator and an admin go to the staff home', () => {
    expect(homePageFor('moderator', false)).toBe('staff.html');
    expect(homePageFor('admin', false)).toBe('staff.html');
  });

  test('staff go to the staff home even if they are also listeners', () => {
    expect(homePageFor('admin', true)).toBe('staff.html');
  });

  test('a missing or unknown role goes to the ordinary dashboard', () => {
    expect(homePageFor(null, false)).toBe('dashboard.html');
    expect(homePageFor(undefined, false)).toBe('dashboard.html');
    expect(homePageFor('superuser', false)).toBe('dashboard.html');
  });
});
