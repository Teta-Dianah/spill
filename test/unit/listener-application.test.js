const {
  VETTING_CONTACT_EMAIL,
  MIN_ANSWER_LENGTH,
  MAX_ANSWER_LENGTH,
  HOURS_PER_WEEK_OPTIONS,
  OFFLINE_CHECKS,
  makeReferenceCode,
  checkListenerApplication,
  allChecksDone,
  cleanRejectionReason,
  applicationStep,
} = require('../../public/js/listener-application.js');

// A complete, acceptable set of answers.
function answers(overrides = {}) {
  return {
    confirmedAge21: true,
    motivation: 'I want to be there for people my age when things get heavy.',
    experience: 'I have supported classmates through exam stress.',
    hoursPerWeek: '3-5',
    scenarioCrisis: 'I would stay with them, listen, and let the crisis card do its part.',
    scenarioContact: 'I would say no kindly and remind them everything stays on Spill.',
    agreedConduct: true,
    agreedChecks: true,
    ...overrides,
  };
}

const ALL_CHECKS = { identity: true, references: true, policeClearance: true, interview: true };

describe('makeReferenceCode', () => {
  test('has the shape SPL- then six characters', () => {
    expect(makeReferenceCode(Math.random)).toMatch(/^SPL-[A-Z2-9]{6}$/);
  });

  test('never uses characters that are easy to mix up', () => {
    for (let i = 0; i < 200; i++) {
      expect(makeReferenceCode(Math.random)).not.toMatch(/[01OI]/);
    }
  });

  test('uses the random numbers it is given', () => {
    expect(makeReferenceCode(() => 0)).toBe('SPL-AAAAAA');
    expect(makeReferenceCode(() => 0.999999)).toBe('SPL-999999');
  });
});

describe('checkListenerApplication', () => {
  test('accepts a complete application and trims the answers', () => {
    const result = checkListenerApplication(answers({ motivation: '   ' + answers().motivation + '  ' }));
    expect(result.error).toBeUndefined();
    expect(result.application.motivation).toBe(answers().motivation);
    expect(result.application.confirmedAge21).toBe(true);
  });

  test('saves only the fields the Security Rules allow', () => {
    const result = checkListenerApplication(answers({ fullName: 'A Real Name', phone: '0788123456' }));
    expect(Object.keys(result.application).sort()).toEqual([
      'agreedChecks', 'agreedConduct', 'confirmedAge21', 'experience', 'hoursPerWeek',
      'motivation', 'scenarioContact', 'scenarioCrisis',
    ]);
  });

  test('every listener must confirm they are 21 or older', () => {
    expect(checkListenerApplication(answers({ confirmedAge21: false })).error).toMatch(/21 or older/);
    expect(checkListenerApplication(answers({ confirmedAge21: 'yes' })).error).toMatch(/21 or older/);
    expect(checkListenerApplication(null).error).toMatch(/21 or older/);
  });

  test.each(['motivation', 'scenarioCrisis', 'scenarioContact'])('%s is required and must not be too short', (field) => {
    expect(checkListenerApplication(answers({ [field]: '' })).error).toBeDefined();
    expect(checkListenerApplication(answers({ [field]: 'x'.repeat(MIN_ANSWER_LENGTH - 1) })).error).toBeDefined();
    expect(checkListenerApplication(answers({ [field]: 'x'.repeat(MIN_ANSWER_LENGTH) })).error).toBeUndefined();
  });

  test.each(['motivation', 'scenarioCrisis', 'scenarioContact', 'experience'])('%s must not be too long', (field) => {
    expect(checkListenerApplication(answers({ [field]: 'x'.repeat(MAX_ANSWER_LENGTH + 1) })).error).toBeDefined();
    expect(checkListenerApplication(answers({ [field]: 'x'.repeat(MAX_ANSWER_LENGTH) })).error).toBeUndefined();
  });

  test('spaces alone do not count as an answer', () => {
    expect(checkListenerApplication(answers({ motivation: ' '.repeat(60) })).error).toBeDefined();
  });

  test('experience is optional', () => {
    const result = checkListenerApplication(answers({ experience: undefined }));
    expect(result.error).toBeUndefined();
    expect(result.application.experience).toBe('');
  });

  test('hours a week must be one of the choices', () => {
    HOURS_PER_WEEK_OPTIONS.forEach((option) => {
      expect(checkListenerApplication(answers({ hoursPerWeek: option })).error).toBeUndefined();
    });
    expect(checkListenerApplication(answers({ hoursPerWeek: '' })).error).toBeDefined();
    expect(checkListenerApplication(answers({ hoursPerWeek: 'all day' })).error).toBeDefined();
  });

  test('both agreements are required', () => {
    expect(checkListenerApplication(answers({ agreedConduct: false })).error).toMatch(/code of conduct/);
    expect(checkListenerApplication(answers({ agreedChecks: false })).error).toMatch(/in-person checks/);
  });
});

describe('allChecksDone', () => {
  test('there are four in-person checks', () => {
    expect(OFFLINE_CHECKS.map((check) => check.key)).toEqual(['identity', 'references', 'policeClearance', 'interview']);
  });

  test('true only when all four are ticked', () => {
    expect(allChecksDone(ALL_CHECKS)).toBe(true);
  });

  test.each(['identity', 'references', 'policeClearance', 'interview'])('false when %s is missing', (key) => {
    expect(allChecksDone({ ...ALL_CHECKS, [key]: false })).toBe(false);
    const withoutKey = { ...ALL_CHECKS };
    delete withoutKey[key];
    expect(allChecksDone(withoutKey)).toBe(false);
  });

  test('false when nothing has been recorded', () => {
    expect(allChecksDone(undefined)).toBe(false);
    expect(allChecksDone({})).toBe(false);
  });

  test('only a real true counts as ticked', () => {
    expect(allChecksDone({ ...ALL_CHECKS, identity: 'yes' })).toBe(false);
  });
});

describe('cleanRejectionReason', () => {
  test('returns a trimmed reason', () => {
    expect(cleanRejectionReason('  References could not be reached.  ')).toBe('References could not be reached.');
  });

  test('refuses a missing, too short or too long reason', () => {
    expect(cleanRejectionReason('')).toBe('');
    expect(cleanRejectionReason('no')).toBe('');
    expect(cleanRejectionReason(undefined)).toBe('');
    expect(cleanRejectionReason('x'.repeat(501))).toBe('');
  });
});

describe('applicationStep', () => {
  const pending = { status: 'pending', trainingComplete: false };

  test('0 when the person has not applied', () => {
    expect(applicationStep(null)).toBe(0);
  });

  test('2, the in-person checks, from the moment they apply until an admin decides', () => {
    expect(applicationStep(pending)).toBe(2);
  });

  test('4 when approved but not trained', () => {
    expect(applicationStep({ status: 'approved', trainingComplete: false })).toBe(4);
  });

  test('5 when approved and trained', () => {
    expect(applicationStep({ status: 'approved', trainingComplete: true })).toBe(5);
  });

  test('-1 when rejected', () => {
    expect(applicationStep({ status: 'rejected' })).toBe(-1);
  });
});

describe('the contact for in-person checks', () => {
  test('is an email address', () => {
    expect(VETTING_CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });
});
