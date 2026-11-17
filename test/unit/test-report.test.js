const { buildTestReport, requirementIds, compareIds } = require('../../scripts/test-report.js');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// A small made-up Jest result, in the shape "jest --json" saves.
function fakeResults(statuses) {
  return {
    startTime: new Date(2026, 10, 17).getTime(),
    success: statuses.every((status) => status === 'passed'),
    numTotalTestSuites: 1,
    numTotalTests: statuses.length,
    numPassedTests: statuses.filter((status) => status === 'passed').length,
    numFailedTests: statuses.filter((status) => status === 'failed').length,
    numPendingTests: 0,
    testResults: [
      {
        name: path.join(ROOT, 'test', 'unit', 'pages.test.js'),
        assertionResults: statuses.map((status, index) => ({
          ancestorTitles: ['every page (NFR 5)'],
          title: `check ${index} (FR 6.2, BR 3)`,
          status,
        })),
      },
    ],
  };
}

describe('requirementIds', () => {
  test('finds FR, NFR and BR IDs in a test name, once each', () => {
    expect(requirementIds('crisis flags (FR 6.2, NFR 4) and FR 6.2 again, BR 3')).toEqual(['FR 6.2', 'NFR 4', 'BR 3']);
  });

  test('ignores look-alikes', () => {
    expect(requirementIds('FRIENDS 2 and NFR4 and BRB')).toEqual([]);
  });
});

describe('compareIds', () => {
  test('sorts FR, then NFR, then BR, by number', () => {
    expect(['BR 3', 'NFR 21', 'FR 6.2', 'NFR 4', 'FR 1.4', 'FR 6.10'].sort(compareIds)).toEqual([
      'FR 1.4',
      'FR 6.2',
      'FR 6.10',
      'NFR 4',
      'NFR 21',
      'BR 3',
    ]);
  });
});

describe('buildTestReport', () => {
  test('a passing run says so and counts each requirement', () => {
    const report = buildTestReport(fakeResults(['passed', 'passed']));
    expect(report).toContain('**Every test passed.**');
    expect(report).toContain('| `test/unit/pages.test.js` |');
    expect(report).toContain('| NFR 5 | 2 | 2 | pages.test.js |');
    expect(report).not.toContain('## Failed tests');
  });

  test('a run with a failure lists the failed test', () => {
    const report = buildTestReport(fakeResults(['passed', 'failed']));
    expect(report).toContain('**Some tests failed.**');
    expect(report).toContain('## Failed tests');
    expect(report).toContain('every page (NFR 5) > check 1 (FR 6.2, BR 3)');
  });
});
