# Test report

A full run of Spill's automated tests on 2026-11-17: the unit tests and the Security Rules tests on the Firestore emulator (NFR 21). The same tests run on GitHub Actions on every push.

This file is written by `npm run test:report` (`scripts/test-report.js`). Run it again to bring it up to date.

## Result

| | Count |
|---|---|
| Test files | 13 |
| Tests | 544 |
| Passed | 544 |
| Failed | 0 |
| Skipped | 0 |

**Every test passed.**

## Each test file

| File | What it covers | Tests | Passed |
|---|---|---|---|
| `test/rules/firestore.test.js` | Security Rules on the Firestore emulator: who can read and write what | 191 | 191 |
| `test/rules/lockdown.test.js` | The lock-down rules for a data breach refuse everything but the helplines | 8 | 8 |
| `test/unit/home-summary.test.js` | The numbers and wording on each home page | 25 | 25 |
| `test/unit/listener-application.test.js` | The listener application and its checks | 33 | 33 |
| `test/unit/model-check-settings.test.js` | When the model check may switch on | 22 | 22 |
| `test/unit/mood-validate.test.js` | Mood check-in validation | 6 | 6 |
| `test/unit/pages.test.js` | Every page: "Need help now", viewport, no inline styles, home page privacy | 138 | 138 |
| `test/unit/pseudonym.test.js` | Pseudonym generation | 4 | 4 |
| `test/unit/screening-report.test.js` | The screening report stays in step with the code | 7 | 7 |
| `test/unit/screening.test.js` | Message screening, admin terms and the model check answer handling | 87 | 87 |
| `test/unit/seed-demo-accounts.test.js` | The demo accounts script refuses to run unless both emulators are on this computer | 6 | 6 |
| `test/unit/staff-links.test.js` | Staff links, and which home page each role lands on | 12 | 12 |
| `test/unit/test-report.test.js` | This report: finding requirement IDs and listing failures | 5 | 5 |

## Requirements named in the tests

Each row counts the tests whose name, or the name of the group they sit in, gives that requirement ID. Many other tests check the same requirements without naming them, so this is a floor, not the full picture.

| Requirement | Tests | Passed | In |
|---|---|---|---|
| FR 1.1 | 6 | 6 | firestore.test.js |
| FR 1.3 | 10 | 10 | firestore.test.js, pages.test.js |
| FR 1.5 | 1 | 1 | firestore.test.js |
| FR 4.1 | 2 | 2 | firestore.test.js |
| FR 5.5 | 4 | 4 | firestore.test.js |
| FR 6.2 | 3 | 3 | firestore.test.js |
| FR 6.3 | 1 | 1 | firestore.test.js |
| FR 6.6 | 3 | 3 | firestore.test.js |
| FR 6.8 | 2 | 2 | firestore.test.js |
| FR 6.9 | 2 | 2 | firestore.test.js |
| FR 7.1 | 58 | 58 | firestore.test.js, screening.test.js |
| NFR 4 | 1 | 1 | firestore.test.js |
| NFR 5 | 16 | 16 | pages.test.js |
| NFR 11 | 1 | 1 | firestore.test.js |
| NFR 14 | 20 | 20 | firestore.test.js, lockdown.test.js, pages.test.js |
| NFR 19 | 2 | 2 | firestore.test.js |
| NFR 21 | 17 | 17 | screening-report.test.js, screening.test.js |
| BR 1 | 3 | 3 | firestore.test.js |
| BR 3 | 13 | 13 | firestore.test.js, pages.test.js |
| BR 4 | 5 | 5 | firestore.test.js |
| BR 7 | 3 | 3 | firestore.test.js |
| BR 8 | 2 | 2 | lockdown.test.js, pages.test.js |

## Screening and speed

- **Screening (NFR 21):** precision and recall on the labelled sets, against the goal of catching 90% of crisis and contact-sharing messages, are in [screening-report.md](screening-report.md).
- **Crisis flags reach the queue within 1 minute (NFR 4):** a Security Rules test has a moderator watch the open flags live while a user sends a crisis message with its flag. It fails if the flag takes a minute or more, and prints the time it took. It runs on the emulator, so it shows the app adds no wait of its own, such as polling or a server step; the real network adds its own time on top.

## Not covered by these tests

- **Pages in a real browser.** Layout at 320, 390, 768 and 1280 px wide, "Need help now" on every page, and each role's walk through the app are checked in Chrome against the emulators before each release, not on every push.
- **The model check service itself.** The tests cover what the app does with an answer, a broken answer and no answer. The service is never called in a test; the screening report uses its saved answers.
- **The real Firebase project.** Every test runs on the emulator. The deployed site is checked by hand after each deploy.
