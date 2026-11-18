const { readConfig, deployProblems } = require('../../scripts/deploy-checks.js');

function config(projectId, modelCheck = false, placeholder = false) {
  return `var firebaseConfig = {
  apiKey: '${placeholder ? 'REPLACE_ME' : 'abc'}',
  projectId: '${projectId}',
};
var modelCheckEnabled = ${modelCheck};
`;
}
const onMain = { branch: 'main', clean: true };

describe('readConfig', () => {
  test('reads the project and the model check setting', () => {
    expect(readConfig(config('spill-pilot', true))).toEqual({ projectId: 'spill-pilot', modelCheckEnabled: true, hasPlaceholders: false });
  });

  test('the template counts as unfinished', () => {
    expect(readConfig(config('demo-spill-dev', false, true)).hasPlaceholders).toBe(true);
  });

  test('a missing setting means the model check is off', () => {
    expect(readConfig("projectId: 'spill-dev-01'").modelCheckEnabled).toBe(false);
  });
});

describe('deployProblems (NFR 22)', () => {
  test('a matching config from a clean main is fine', () => {
    expect(deployProblems('pilot', config('spill-pilot'), 'spill-pilot', onMain)).toEqual([]);
    expect(deployProblems('dev', config('spill-dev-01', true), 'spill-dev-01', onMain)).toEqual([]);
  });

  test('a config for the other project is refused', () => {
    const problems = deployProblems('pilot', config('spill-dev-01'), 'spill-pilot', onMain);
    expect(problems.join(' ')).toMatch(/wrong project/);
  });

  test('a missing or unfinished config is refused', () => {
    expect(deployProblems('pilot', null, 'spill-pilot', onMain).join(' ')).toMatch(/no config/);
    expect(deployProblems('pilot', config('spill-pilot', false, true), 'spill-pilot', onMain).join(' ')).toMatch(/REPLACE_ME/);
  });

  test('the model check can never be switched on for the pilot', () => {
    expect(deployProblems('pilot', config('spill-pilot', true), 'spill-pilot', onMain).join(' ')).toMatch(/must stay off/);
  });

  test('the pilot is only deployed from main', () => {
    const problems = deployProblems('pilot', config('spill-pilot'), 'spill-pilot', { branch: 'develop', clean: true });
    expect(problems.join(' ')).toMatch(/only deployed from main/);
  });

  test('the development project can be deployed from another branch', () => {
    expect(deployProblems('dev', config('spill-dev-01'), 'spill-dev-01', { branch: 'develop', clean: true })).toEqual([]);
  });

  test('uncommitted changes are refused for either project', () => {
    expect(deployProblems('dev', config('spill-dev-01'), 'spill-dev-01', { branch: 'main', clean: false })).toHaveLength(1);
  });

  test('an unknown target is refused', () => {
    expect(deployProblems('production', config('x'), 'x', onMain).join(' ')).toMatch(/Unknown target/);
  });
});
