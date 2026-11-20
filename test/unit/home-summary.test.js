const {
  timeAgo,
  waitingFor,
  topicWord,
  moodWord,
  moodSummary,
  monthRecap,
  lastCheckInText,
  queueSummary,
  listenerSummary,
  describeAction,
  listName,
} = require('../../public/js/home-summary.js');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Tuesday 17 November 2026, 15:00 local time.
const NOW = new Date(2026, 10, 17, 15, 0).getTime();

describe('timeAgo', () => {
  test.each([
    [NOW - 20 * 1000, 'just now'],
    [NOW - 5 * MINUTE, '5 min ago'],
    [NOW - HOUR, '1 hour ago'],
    [NOW - 3 * HOUR, '3 hours ago'],
    [NOW - DAY, 'yesterday'],
    [NOW - 4 * DAY, '4 days ago'],
  ])('%s reads as "%s"', (time, words) => {
    expect(timeAgo(time, NOW)).toBe(words);
  });

  test('a missing time does not break the page', () => {
    expect(timeAgo(0, NOW)).toBe('a while ago');
  });
});

describe('waitingFor', () => {
  test('counts short waits in minutes, never less than 1', () => {
    expect(waitingFor(NOW - 10 * 1000, NOW)).toBe('1 min');
    expect(waitingFor(NOW - 40 * MINUTE, NOW)).toBe('40 min');
  });

  test('counts longer waits in hours, then days', () => {
    expect(waitingFor(NOW - HOUR, NOW)).toBe('1 hour');
    expect(waitingFor(NOW - 5 * HOUR, NOW)).toBe('5 hours');
    expect(waitingFor(NOW - DAY, NOW)).toBe('1 day');
    expect(waitingFor(NOW - 3 * DAY, NOW)).toBe('3 days');
  });
});

describe('words for topics and moods', () => {
  test('topics use the same words as the chat request form', () => {
    expect(topicWord('money')).toBe('Money stress');
    expect(topicWord('exams')).toBe('Exams');
    expect(topicWord('anything-else')).toBe('Something else');
  });

  test('moods use the same scale as the check-in form', () => {
    expect([1, 2, 3, 4, 5].map(moodWord)).toEqual(['Rough', 'Low', 'Okay', 'Good', 'Great']);
  });
});

describe('moodSummary (the numbers on a user dashboard)', () => {
  test('counts and averages only this month', () => {
    const entries = [
      { score: 4, time: NOW - HOUR },
      { score: 3, time: NOW - 2 * DAY },
      { score: 1, time: new Date(2026, 9, 30).getTime() }, // last month
    ];
    const summary = moodSummary(entries, NOW);
    expect(summary.countThisMonth).toBe(2);
    expect(summary.averageThisMonth).toBe(3.5);
    expect(summary.lastCheckIn).toBe(NOW - HOUR);
    expect(summary.checkedInToday).toBe(true);
  });

  test('someone with no check-ins gets no average and no last check-in', () => {
    expect(moodSummary([], NOW)).toEqual({
      countThisMonth: 0,
      averageThisMonth: null,
      lastCheckIn: null,
      checkedInToday: false,
    });
  });

  test('the average is rounded to one decimal place', () => {
    const entries = [3, 4, 4].map((score) => ({ score, time: NOW - HOUR }));
    expect(moodSummary(entries, NOW).averageThisMonth).toBe(3.7);
  });
});

describe('lastCheckInText', () => {
  test.each([
    [null, 'Not yet'],
    [NOW - HOUR, 'Today'],
    [NOW - DAY, 'Yesterday'],
    [NOW - 3 * DAY, '3 days ago'],
  ])('%s reads as "%s"', (time, words) => {
    expect(lastCheckInText(time, NOW)).toBe(words);
  });
});

describe('queueSummary (the numbers on a moderator home)', () => {
  test('splits crisis flags, other flags and reports, and finds the oldest', () => {
    const items = [
      { itemType: 'flag', type: 'crisis', time: NOW - HOUR },
      { itemType: 'flag', type: 'abusive-language', time: NOW - 3 * HOUR },
      { itemType: 'flag', type: 'contact-sharing', time: NOW - MINUTE },
      { itemType: 'report', time: NOW - 2 * HOUR },
    ];
    expect(queueSummary(items)).toEqual({ crisis: 1, otherFlags: 2, reports: 1, oldest: NOW - 3 * HOUR });
  });

  test('an empty queue has nothing waiting', () => {
    expect(queueSummary([])).toEqual({ crisis: 0, otherFlags: 0, reports: 0, oldest: null });
  });
});

describe('listenerSummary (the numbers on an admin home)', () => {
  test('counts waiting, approved and available-now listeners', () => {
    const listeners = [
      { status: 'pending', available: false },
      { status: 'approved', available: true },
      { status: 'approved', available: false },
      { status: 'rejected', available: false },
    ];
    expect(listenerSummary(listeners)).toEqual({ waiting: 1, approved: 2, availableNow: 1 });
  });

  test('a listener who is not approved never counts as available', () => {
    expect(listenerSummary([{ status: 'pending', available: true }]).availableNow).toBe(0);
  });
});

describe('describeAction (recent actions from the audit log)', () => {
  test('every action the app writes has plain words', () => {
    [
      'open_case',
      'dismiss',
      'warn',
      'suspend',
      'reinstate',
      'escalate',
      'approve_listener',
      'reject_listener',
      'update_listener_checks',
      'add_term',
      'edit_term',
      'remove_term',
      'reject_term_suggestion',
    ].forEach((action) => {
      expect(describeAction(action)).not.toBe('Other action');
    });
  });

  test('an unknown action still shows something', () => {
    expect(describeAction('something_new')).toBe('Other action');
  });
});

describe('listName', () => {
  test('names each screening list', () => {
    expect(listName('crisis')).toBe('Crisis list');
    expect(listName('abuse')).toBe('Abusive language list');
    expect(listName('contact')).toBe('Contact-sharing list');
  });
});

describe('monthRecap (FR 3.4)', () => {
  // Local times, so the months are right in any time zone.
  const at = (day, month = 10) => new Date(2026, month, day, 10, 0).getTime();
  const now = at(20);

  test('nothing this month: no recap', () => {
    expect(monthRecap([], now)).toBeNull();
    expect(monthRecap([{ score: 3, time: at(5, 9), tags: [] }], now)).toBeNull();
  });

  test('counts, averages and compares with last month', () => {
    const recap = monthRecap([
      { score: 2, time: at(3), tags: ['money-stress'] },
      { score: 4, time: at(12), tags: ['good-news', 'money-stress'] },
      { score: 1, time: at(18), tags: ['tired'] },
      { score: 2, time: at(10, 9), tags: [] },
      { score: 4, time: at(25, 9), tags: [] },
    ], now);
    expect(recap.monthName).toBe('November');
    expect(recap.count).toBe(3);
    expect(recap.average).toBe(2.3);
    expect(recap.lastMonthAverage).toBe(3);
    expect(recap.bestScore).toBe(4);
    expect(recap.bestTime).toBe(at(12));
    expect(recap.roughDays).toBe(2);
    expect(recap.topTag).toBe('money-stress');
  });

  test('no check-ins last month, and no tags: those parts are empty', () => {
    const recap = monthRecap([{ score: 5, time: at(1), tags: [] }, { score: 3, time: at(2) }], now);
    expect(recap.lastMonthAverage).toBeNull();
    expect(recap.topTag).toBeNull();
    expect(recap.roughDays).toBe(0);
  });

  test('a tie for best day goes to the latest', () => {
    const recap = monthRecap([{ score: 4, time: at(2) }, { score: 4, time: at(9) }, { score: 3, time: at(15) }], now);
    expect(recap.bestTime).toBe(at(9));
  });

  test('January compares with December of the year before', () => {
    const recap = monthRecap([{ score: 4, time: new Date(2027, 0, 3, 10).getTime() }, { score: 2, time: at(20, 11) }],
      new Date(2027, 0, 10, 10).getTime());
    expect(recap.count).toBe(1);
    expect(recap.lastMonthAverage).toBe(2);
  });
});