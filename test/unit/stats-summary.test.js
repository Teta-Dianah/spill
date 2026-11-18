const {
  MIN_GROUP,
  TOO_FEW,
  percentText,
  goalStatus,
  changeText,
  summariseAccounts,
  summariseChats,
  summariseSafety,
} = require('../../public/js/stats-summary.js');

describe('small groups stay hidden, so nobody can be picked out', () => {
  test('the smallest group shown is 5', () => {
    expect(MIN_GROUP).toBe(5);
  });

  test('a percentage needs at least 5 in the group', () => {
    expect(percentText(3, 4)).toBe(TOO_FEW);
    expect(percentText(3, 5)).toBe('60%');
    expect(percentText(2, 3)).toBe(TOO_FEW);
  });

  test('an average change needs at least 5 chats', () => {
    expect(changeText(4, 4)).toBe(TOO_FEW);
    expect(changeText(4, 5)).toBe('+0.8');
    expect(changeText(-3, 6)).toBe('-0.5');
    expect(changeText(0, 5)).toBe('0.0');
  });

  test('a goal is only judged once the group is big enough', () => {
    expect(goalStatus(4, 4, 50)).toBeNull();
    expect(goalStatus(3, 5, 60)).toBe('met');
    expect(goalStatus(2, 5, 60)).toBe('not met yet');
  });
});

describe('summariseAccounts', () => {
  test('counts ordinary accounts only, with age bands and first-time answers', () => {
    const accounts = [
      { role: 'user', ageBand: '18-25', firstTimeSeekingHelp: true },
      { role: 'user', ageBand: '18-25', firstTimeSeekingHelp: false },
      { role: 'user', ageBand: '16-17', firstTimeSeekingHelp: true },
      { role: 'user', ageBand: '18-25' },
      { role: 'admin', ageBand: '18-25', firstTimeSeekingHelp: true },
      { role: 'moderator', ageBand: '18-25', firstTimeSeekingHelp: false },
    ];
    expect(summariseAccounts(accounts)).toEqual({ users: 4, youngerBand: 1, olderBand: 3, firstTimeYes: 2, firstTimeAnswered: 3 });
  });
});

describe('summariseChats', () => {
  const chats = [
    { topic: 'money', moodBefore: 2, moodAfter: 4, rating: 'helpful', useAgain: 'yes' },
    { topic: 'money', moodBefore: 3, moodAfter: 3, rating: 'not-helpful', useAgain: 'not-sure' },
    { topic: 'exams', moodBefore: 4, moodAfter: 2, rating: null, useAgain: 'no' },
    { topic: 'family', moodBefore: 1, moodAfter: 3 },
  ];

  test('counts better, same and worse, and the total change', () => {
    const summary = summariseChats(chats);
    expect(summary.chats).toBe(4);
    expect([summary.better, summary.same, summary.worse]).toEqual([2, 1, 1]);
    expect(summary.changeTotal).toBe(2);
  });

  test('counts the answers after a chat, leaving out skipped ones', () => {
    const summary = summariseChats(chats);
    expect([summary.helpful, summary.ratingAnswered]).toEqual([1, 2]);
    expect([summary.useAgainYes, summary.useAgainNo, summary.useAgainNotSure, summary.useAgainAnswered]).toEqual([1, 1, 1, 3]);
  });

  test('counts topics', () => {
    expect(summariseChats(chats).topics).toEqual({ money: 2, exams: 1, family: 1 });
  });

  test('a record without both moods is left out', () => {
    expect(summariseChats([{ topic: 'money', moodBefore: 2 }]).chats).toBe(0);
  });
});

describe('summariseSafety', () => {
  test('counts flags by kind, reports, reviews and cases opened', () => {
    const tallies = [{ kind: 'crisis' }, { kind: 'crisis' }, { kind: 'contact-sharing' }, { kind: 'abusive-language' }, { kind: 'report' }, { kind: 'other' }];
    const audit = [{ action: 'open_case' }, { action: 'dismiss' }, { action: 'suspend' }, { action: 'approve_listener' }, { action: 'add_term' }];
    expect(summariseSafety(tallies, audit)).toEqual({
      crisis: 2,
      contactSharing: 1,
      abusiveLanguage: 1,
      reports: 1,
      raised: 5,
      reviewed: 2,
      casesOpened: 1,
    });
  });
});
