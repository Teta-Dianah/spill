// The model check must be off everywhere except the development project,
// and must only be used for a person who agreed to the notice.
const fs = require('fs');
const {
  MODEL_CHECK_PROJECTS,
  isModelCheckOn,
  readModelCheckChoice,
  saveModelCheckChoice,
  shouldShowModelCheckNotice,
  canUseModelCheck,
} = require('../../public/js/model-check-settings.js');

// A stand-in for the browser's localStorage.
function fakeStorage() {
  const values = {};
  return {
    getItem: (key) => (key in values ? values[key] : null),
    setItem: (key, value) => {
      values[key] = String(value);
    },
  };
}

// A browser that refuses storage (for example, some private windows).
const brokenStorage = {
  getItem: () => {
    throw new Error('storage is blocked');
  },
  setItem: () => {
    throw new Error('storage is blocked');
  },
};

describe('the on/off setting', () => {
  test('only the development project is on the list', () => {
    expect(MODEL_CHECK_PROJECTS).toEqual(['spill-dev-01']);
  });

  test('on for the development project with the setting on', () => {
    expect(isModelCheckOn({ projectId: 'spill-dev-01' }, true)).toBe(true);
  });

  test('off for the development project with the setting off or missing', () => {
    expect(isModelCheckOn({ projectId: 'spill-dev-01' }, false)).toBe(false);
    expect(isModelCheckOn({ projectId: 'spill-dev-01' }, undefined)).toBe(false);
  });

  test('never on for another project, even with the setting on', () => {
    expect(isModelCheckOn({ projectId: 'spill-pilot' }, true)).toBe(false);
    expect(isModelCheckOn({ projectId: 'demo-spill-dev' }, true)).toBe(false);
    expect(isModelCheckOn({ projectId: 'spill-dev-01-copy' }, true)).toBe(false);
    expect(isModelCheckOn({ projectId: 'REPLACE_ME' }, true)).toBe(false);
    expect(isModelCheckOn({}, true)).toBe(false);
    expect(isModelCheckOn(undefined, true)).toBe(false);
  });

  test('only the real value true turns it on', () => {
    expect(isModelCheckOn({ projectId: 'spill-dev-01' }, 'true')).toBe(false);
    expect(isModelCheckOn({ projectId: 'spill-dev-01' }, 1)).toBe(false);
  });

  test('the config template ships with it off, on the emulator-only project', () => {
    const template = fs.readFileSync('public/js/firebase-config.example.js', 'utf8');
    expect(template).toMatch(/var modelCheckEnabled = false;/);
    expect(template).toMatch(/projectId: 'demo-spill-dev'/);
    expect(template).not.toMatch(/modelCheckEnabled = true/);
  });
});

describe('the notice', () => {
  test('is shown when the model check is on and the person has not answered', () => {
    const storage = fakeStorage();
    const choice = readModelCheckChoice(storage, 'alice');
    expect(choice).toBe('');
    expect(shouldShowModelCheckNotice(true, choice)).toBe(true);
    expect(canUseModelCheck(true, choice)).toBe(false);
  });

  test('never appears when the model check is off', () => {
    expect(shouldShowModelCheckNotice(false, '')).toBe(false);
    expect(shouldShowModelCheckNotice(false, 'agreed')).toBe(false);
    expect(shouldShowModelCheckNotice(false, 'declined')).toBe(false);
  });

  test('agree: remembered, not asked again, model check used', () => {
    const storage = fakeStorage();
    saveModelCheckChoice(storage, 'alice', 'agreed');
    const choice = readModelCheckChoice(storage, 'alice');
    expect(choice).toBe('agreed');
    expect(shouldShowModelCheckNotice(true, choice)).toBe(false);
    expect(canUseModelCheck(true, choice)).toBe(true);
  });

  test('decline: remembered, not asked again, model check not used', () => {
    const storage = fakeStorage();
    saveModelCheckChoice(storage, 'alice', 'declined');
    const choice = readModelCheckChoice(storage, 'alice');
    expect(choice).toBe('declined');
    expect(shouldShowModelCheckNotice(true, choice)).toBe(false);
    expect(canUseModelCheck(true, choice)).toBe(false);
  });

  test('agreeing does not turn the model check on where it is off', () => {
    expect(canUseModelCheck(false, 'agreed')).toBe(false);
  });

  test('the choice belongs to one account, not the whole browser', () => {
    const storage = fakeStorage();
    saveModelCheckChoice(storage, 'alice', 'agreed');
    expect(readModelCheckChoice(storage, 'bob')).toBe('');
  });

  test('an unexpected stored value counts as not answered', () => {
    const storage = fakeStorage();
    storage.setItem('spill-model-check-choice-alice', 'yes please');
    expect(readModelCheckChoice(storage, 'alice')).toBe('');
  });

  test('blocked storage counts as not answered, so the model check is not used', () => {
    saveModelCheckChoice(brokenStorage, 'alice', 'agreed');
    const choice = readModelCheckChoice(brokenStorage, 'alice');
    expect(choice).toBe('');
    expect(canUseModelCheck(true, choice)).toBe(false);
  });
});
