# Data breach procedure

What to do if Spill's data may have been seen, changed, lost or taken by someone who should not have it (NFR 14). Rwanda's data protection law, Law No. 058/2021, requires a breach to be reported to the supervisory authority within **48 hours of becoming aware of it** (Art. 43). In Rwanda that authority is the **National Cyber Security Authority (NCSA)**.

The steps below are written for Spill as it is built: Firebase Authentication, Cloud Firestore and Firebase Hosting, with no server of its own.

| | |
|---|---|
| Responsible person | Dianah Teta |
| Contact | d.teta@alustudent.com |
| Projects | `spill-dev-01` (development). The pilot project, when it exists, follows the same steps. |

## What counts as a breach

Anything that exposes, changes or loses personal data, on purpose or by accident. For Spill, for example:

- A bug in `firestore.rules` lets someone read chats, check-ins or accounts that are not theirs.
- A moderator or admin account is used by someone else, for example after its password leaks.
- Someone opens chats outside a moderator case, or a moderator opens cases with no reason.
- A file exported from the Firebase console (accounts, chats) is shared, lost or left on a shared computer.
- Messages are sent somewhere they should not go, for example the model check switched on for a project where it must be off.
- A device signed in to the Firebase console, or to a staff account, is lost or stolen.

If unsure, treat it as a breach and start the clock. It costs little to stand down later.

## The clock starts when you find out

Write down the date and time at once. Everything below is counted from that moment, and the 48 hours run on weekends too.

## 1. Contain it (first hour)

Stop it getting worse before working out the details.

**If data can be read or changed by the wrong people, or you don't know yet: lock the database.** `firestore.lockdown.rules` refuses every read and write for everyone, staff included. Only the public list of helplines stays on, so "Need help now" still works (BR 8). From the project folder:

```bash
cp firestore.lockdown.rules firestore.rules
npx firebase deploy --only firestore:rules --project spill-dev-01
git checkout firestore.rules
```

The last line puts the normal rules back in the folder only; the lock-down stays live until the normal rules are deployed again (step 5). While it is on, nobody can sign in to chat, check in or moderate.

**If an account is being misused:**

- In the Firebase console, open Authentication, find the account by its email, and choose **Disable account**. That stops it signing in again, but a session already open can keep working for up to an hour. If that hour matters, lock the database as above as well.
- If it is a moderator or admin, open Firestore, find `accounts/{that uid}`, and set `role` back to `user`.
- Ask the owner to choose a new password before the account is turned back on.

**If a file of exported data is out:** ask anyone who has it to delete it, and write down who had it and when.

**Spill holds no service-account keys or API secrets of its own**, so there is no key to rotate. The web config in `firebase-config.js` is public by design.

## 2. Work out what happened (within 24 hours)

Write the answers down as you go; they are what the report in step 3 needs.

- **What data?** Accounts (made-up names, age bands), emails, check-ins and notes, chats and messages, flags and reports, listener applications. Chats, check-ins and moods are about people's mental health, which the law treats as **sensitive data** (Art. 3).
- **How many people and records,** roughly.
- **When did it start and stop?**
- **Who could have seen it,** and is there any sign they did?
- **What harm could it cause** the people involved?

Where to look:

- The `auditLog` collection records every moderator and admin action, including each time a chat was opened through a case.
- The Firebase console shows each account's sign-in times (Authentication) and the project's read and write totals (Usage).
- Google Cloud's Logging page has the project's admin activity. Firestore's data-access logs are **off** by default, so it may not be possible to say exactly which documents were read. If so, assume the worst case for that data and say so in the report.

## 3. Report to the NCSA (within 48 hours)

Report even if some answers are still unknown: send what is known, and follow up with the rest. Check the NCSA's website (cyber.gov.rw) for its current way of receiving breach reports.

The report should say:

- what happened, and when it started, stopped and was found;
- what kinds of personal data, roughly how many people and records, and that some of it is sensitive (mental health);
- the likely effects on those people;
- what has been done to contain it, and what will be done next;
- who to contact: Dianah Teta, d.teta@alustudent.com.

Keep a copy of what was sent and when.

## 4. Tell the people affected

If the breach could harm them, tell them directly, in plain words, without waiting for the investigation to finish. Their emails are in the Firebase console under Authentication; Spill has no other way to reach them.

Say what happened, what of theirs was involved, what Spill has done, what they can do (for example, change their password, delete their account), and how to ask questions. Keep it calm and short, and never blame them. Many Spill users are going through a hard time, so include the helplines from the crisis card.

## 5. Fix it and reopen

- Fix the cause. For a rules bug, add a test to `test/rules/firestore.test.js` that fails on the bug and passes after the fix.
- Run `npm test` and `npm run lint`.
- Deploy the normal rules: `npx firebase deploy --only firestore:rules --project spill-dev-01`.
- Turn disabled accounts back on once their owners have new passwords.

## 6. Look back (within a week)

Write a short private record: the timeline, what was affected, what was reported and to whom, and what changes to stop it happening again. Keep it **out of this public repository**, because it may hold personal data. Update this procedure if any step did not work.

## Practise it

Before the pilot starts, try step 1 once on the emulators, so the steps are familiar before they are needed: copy `firestore.lockdown.rules` over `firestore.rules`, run `npm run emulators`, check that only the home page helplines still load, then stop the emulators and run `git checkout firestore.rules`. `test/rules/lockdown.test.js` checks on every push that the lock-down rules refuse everything but the helplines.
