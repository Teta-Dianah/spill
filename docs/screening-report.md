# Screening report (NFR 21)

How well Spill's message screening catches crisis language, contact-sharing and abusive language on labelled test messages. The SRS sets two numbers to meet: **precision and recall reported on at least 40 labelled messages** (NFR 21), and a pilot goal of **catching at least 90% of crisis language and of contact-sharing in a test set**.

This file is written by `npm run report:screening` (`scripts/screening-report.js`). Do not edit it by hand: a unit test fails if it no longer matches what the script writes.

## How to read the numbers

- **Caught** is recall: of the messages that should have been flagged, how many were. This is the number the 90% goal is about.
- **False alarms** are messages flagged that should not have been. Precision is the share of flags that were right.
- Every message is checked for all three kinds, so a normal message flagged as crisis counts as a crisis false alarm.

Three set-ups are compared, each adding to the one before:

1. **Built-in lists only:** the term lists and patterns in `public/js/screening.js`.
2. **With the starter terms:** plus the terms in `public/data/term-lists-seed.json`, which an admin adds with "Import starter terms".
3. **With the model check too:** plus the model check (Google Gemini, `gemini-3.5-flash-lite`), worked out the way the chat page does it. A message blocked for contact-sharing or already flagged as crisis is not sent to the model, and the model can only add one crisis or abuse finding, at level 2 or 3. Its answers were saved on 2026-11-11 with the same instructions as `public/js/model-check.js` (`test/data/model-check-answers.json`).

The model check is a demo prototype that runs only in the development project, and only for people who agreed to it (see the README). Everyone else gets set-up 2 once the starter terms are imported, or set-up 1 before then. `firestore.rules` has its own small, fixed patterns as a backstop, which `test/rules/firestore.test.js` tests separately; they are not scored here.

## Summary

On the third set: held out, and large enough (42 messages) for the NFR 21 bar of 40:

| | Crisis language | Contact-sharing |
|---|---|---|
| Built-in lists only | 1 of 15 (7%), goal not met | 5 of 8 (63%), goal not met |
| With the starter terms | 2 of 15 (13%), goal not met | 5 of 8 (63%), goal not met |
| With the model check too | 15 of 15 (100%), goal met | 5 of 8 (63%), goal not met |

- Without the model check, the term lists catch 2 of 15 (13%) of the crisis messages: they only find a phrase written the way it was listed, and most of these messages are reworded or informal.
- With the model check added, which reads what a message means, screening catches 15 of 15 (100%).
- Contact-sharing: 5 of 8 (63%), goal not met. The model check can't help here, because it never blocks a message. The messages missed: "dm me", "slide into my dms", "hit me up on ig, it's easier than here".
- False alarm: "What's the point in going on that trip if it's raining?" was flagged as crisis language by the starter terms, though it is an everyday message.
- False alarm: "I'm ending it all with this group project today, finally done!" was flagged as crisis language by the starter terms, though it is an everyday message.
- The sets are small and were written by the developer, so these numbers show where the gaps are, not a rate to expect with real users.

## The test sets

All messages are made up for testing. None came from a real person.

| Set | Messages | Crisis | Contact | Abuse | Neither | Held out? | Where |
|---|---|---|---|---|---|---|---|
| First set | 46 | 11 | 11 | 5 | 20 | No | in test/screening-sets.js |
| Small early set | 16 | 8 | 4 | 2 | 2 | Yes, but small | in test/screening-sets.js |
| Second set | 47 | 14 | 10 | 9 | 14 | No, tuned | test/data/screening-held-out-2.txt |
| Third set | 42 | 15 | 8 | 6 | 13 | Yes | test/data/screening-held-out-3.txt |

- **First set:** Used while writing the built-in term lists and patterns.
- **Small early set:** Written after the first set, mostly Kinyarwanda and reworded English. No term or rule was changed to improve its score, but it has only 16 messages, so the held-out results below come from the third set.
- **Second set:** Written separately. Held out for its first run only: some starter terms were then fixed because of its misses, so it now counts as tuned.
- **Third set:** Held out. Run once, after the term fixes. No term or rule has been changed because of it.

A message can have more than one label: one message in the first set has both crisis wording and a phone number. Only a held-out set shows how screening does on wording nobody tuned it for. The others show that the terms do what they were added for.

## Crisis language

| Set | Set-up | Caught | False alarms | 90% goal |
|---|---|---|---|---|
| First set | Built-in lists only | 11 of 11 (100%) | 0 | met |
| First set | With the starter terms | 11 of 11 (100%) | 0 | met |
| First set | With the model check too | 11 of 11 (100%) | 0 | met |
| Small early set | Built-in lists only | 1 of 8 (13%) | 0 | not met |
| Small early set | With the starter terms | 3 of 8 (38%) | 0 | not met |
| Small early set | With the model check too | 8 of 8 (100%) | 0 | met |
| Second set | Built-in lists only | 0 of 14 (0%) | 0 | not met |
| Second set | With the starter terms | 14 of 14 (100%) | 0 | met |
| Second set | With the model check too | 14 of 14 (100%) | 0 | met |
| Third set (held out) | Built-in lists only | 1 of 15 (7%) | 0 | not met |
| Third set (held out) | With the starter terms | 2 of 15 (13%) | 2 (precision 50%) | not met |
| Third set (held out) | With the model check too | 15 of 15 (100%) | 2 (precision 88%) | met |

## Contact-sharing

| Set | Set-up | Caught | False alarms | 90% goal |
|---|---|---|---|---|
| First set | Built-in lists only | 11 of 11 (100%) | 0 | met |
| First set | With the starter terms | 11 of 11 (100%) | 0 | met |
| Small early set | Built-in lists only | 4 of 4 (100%) | 0 | met |
| Small early set | With the starter terms | 4 of 4 (100%) | 0 | met |
| Second set | Built-in lists only | 6 of 10 (60%) | 0 | not met |
| Second set | With the starter terms | 9 of 10 (90%) | 0 | met |
| Third set (held out) | Built-in lists only | 5 of 8 (63%) | 0 | not met |
| Third set (held out) | With the starter terms | 5 of 8 (63%) | 0 | not met |

The model check is not shown here, because it never adds a contact-sharing finding. Blocking a message is left to the term lists, the patterns and `firestore.rules`.

## Abusive language

| Set | Set-up | Caught | False alarms | 90% goal |
|---|---|---|---|---|
| First set | Built-in lists only | 5 of 5 (100%) | 0 | no goal set |
| First set | With the starter terms | 5 of 5 (100%) | 0 | no goal set |
| First set | With the model check too | 5 of 5 (100%) | 0 | no goal set |
| Small early set | Built-in lists only | 0 of 2 (0%) | 0 | no goal set |
| Small early set | With the starter terms | 1 of 2 (50%) | 0 | no goal set |
| Small early set | With the model check too | 2 of 2 (100%) | 0 | no goal set |
| Second set | Built-in lists only | 4 of 9 (44%) | 0 | no goal set |
| Second set | With the starter terms | 9 of 9 (100%) | 0 | no goal set |
| Second set | With the model check too | 9 of 9 (100%) | 0 | no goal set |
| Third set (held out) | Built-in lists only | 0 of 6 (0%) | 0 | no goal set |
| Third set (held out) | With the starter terms | 0 of 6 (0%) | 0 | no goal set |
| Third set (held out) | With the model check too | 6 of 6 (100%) | 0 | no goal set |

## By language, on the held-out set

How each set-up does on the third set for messages in each language.

| Language | Kind | Messages | Built-in lists only | With the starter terms | With the model check too |
|---|---|---|---|---|---|
| English | Crisis language | 10 | 1 of 10 (10%) | 1 of 10 (10%) | 10 of 10 (100%) |
| English | Contact-sharing | 6 | 3 of 6 (50%) | 3 of 6 (50%) | same as starter terms |
| English | Abusive language | 5 | 0 of 5 (0%) | 0 of 5 (0%) | 5 of 5 (100%) |
| Kinyarwanda | Crisis language | 2 | 0 of 2 (0%) | 1 of 2 (50%) | 2 of 2 (100%) |
| Mixed | Crisis language | 3 | 0 of 3 (0%) | 0 of 3 (0%) | 3 of 3 (100%) |
| Mixed | Contact-sharing | 2 | 2 of 2 (100%) | 2 of 2 (100%) | same as starter terms |
| Mixed | Abusive language | 1 | 0 of 1 (0%) | 0 of 1 (0%) | 1 of 1 (100%) |

## What the full set-up still gets wrong on the held-out set

With the starter terms and the model check together:

**Missed**

- contact-sharing (english): "dm me"
- contact-sharing (english): "slide into my dms"
- contact-sharing (english): "hit me up on ig, it's easier than here"

**False alarms**

- crisis language (english): "What's the point in going on that trip if it's raining?" (labelled normal, flagged by the starter terms)
- crisis language (english): "I'm ending it all with this group project today, finally done!" (labelled normal, flagged by the starter terms)

No term or rule is changed because of this list, since that would stop this set being held out. Any fix needs a new set, written after the fix, to show whether it works.
