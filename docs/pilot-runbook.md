# Pilot runbook

How to get Spill's pilot ready, run it and close it. The SRS plans a small pilot after Sprint 4: about **30 users and 5 trained listeners**, adults (18 or over) who agree to take part, in the pilot project `spill-pilot`, kept apart from development (NFR 22).

Each step says who does it. "Owner" is the person responsible for Spill's data (Dianah Teta).

## 1. Before the pilot

### Decisions that must come first

These are in [legal-privacy-checklist.md](legal-privacy-checklist.md), under "Decided for the pilot". The owner answered each one on 2026-11-19.

- [x] NCSA registration (Art. 29): not needed for the pilot.
- [x] Data protection officer (Art. 40): not needed for about 30 people.
- [x] Data stored outside Rwanda (South Africa): the pilot may go ahead, with adult volunteers who agree to this in the privacy notice.
- [x] Ethics approval: not needed. The in-app consent is the volunteers' consent record.
- [x] Only adults (18 or over) are invited. 16 and 17 year olds wait until an adviser has confirmed the consent rules (SRS 2.7).

### The pilot project, once (Firebase console, `spill-pilot`)

Already done: the project, its Firestore database (`africa-south1`), its web app and its Hosting site.

- [x] Owner: Authentication > Sign-in method: turn on **Email/Password**.
- [x] Owner: Authentication > Settings > Authorised domains: check `spill-pilot.web.app` is listed.
- [x] Owner: Authentication > Settings > Password policy, if the console offers it: require at least 8 characters, to match NFR 6. The sign-up form already asks for 8, but only the console setting enforces it.
- [ ] Owner: two-step verification on the Google account that owns the project. Anyone with that account can read every chat. Not turned on: the owner decided on 2026-11-19 that it is not needed for the pilot. A strong password used nowhere else is then the account's only protection.
- [ ] Owner: **do not** set up AI Logic in this project. The model check is a demo prototype, and `npm run deploy:pilot` refuses to deploy with it on.

### Deploy (developer)

From a clean, up-to-date `main`:

```bash
git checkout main
git pull
npm run deploy:pilot
```

It checks that `config/firebase-config.pilot.js` is for `spill-pilot` and has the model check off, runs every test and the linter, deploys the site and then the rules, and finishes with `npm run smoke:pilot`, which reads the live site to check it. See "Deployment" in the README.

- [x] **Deployed** on 2026-11-19 to https://spill-pilot.web.app. The live check passed.
- [x] **Uptime check: not needed for the pilot.** For this school project, testing (including the teacher's) happens on the development site, https://spill-dev-01.web.app, and the pilot stays deployed but unused. So `.github/workflows/uptime.yml` keeps checking the development site every 3 hours, and that run history is the 95% availability record (NFR 18). See `docs/performance.md`.

### People and content (in the deployed app)

- [ ] **Admin and moderators.** Each signs up on `spill-pilot.web.app` with their own email and a strong password that is not used anywhere else. The owner then sets `role` to `admin` or `moderator` in Firestore > `accounts`. At least two moderators, so flags are reviewed within 24 hours (NFR 4) even when one is away.
- [ ] **Listeners (target 5).** Each applies on `listener-apply.html`. The admin does the four in-person checks (identity, two references, police clearance, interview), ticks them on `admin-listeners.html` and approves. Each listener then finishes `listener-training.html`. Every listener is 21 or older; only clear a listener for 16 and 17 year olds if they will be in a later pilot.
- [ ] **Helplines and clinics.** Admin: call each one to check it still works, then add it on `admin-resources.html` with today's date as "last verified". Recheck the three helplines built into the crisis card (`public/js/crisis-card.js`) the same way.
- [ ] **Screening terms.** Admin: on `admin-terms.html`, press "Import starter terms".
- [ ] **Walk through it once.** With two test accounts, a user signs up, checks in and asks for a chat; a listener accepts; the user sends a crisis test message ("I want to kill myself"); the crisis card appears; the flag reaches the moderator queue; the moderator opens the case and resolves it with a reason. Then delete both test accounts.
- [ ] **Breach procedure.** Read [breach-procedure.md](breach-procedure.md), and try the lock-down on the emulators once.

## 2. During the pilot

| How often | Who | What |
|---|---|---|
| Every day | Moderators | Clear the queue. Crisis flags first; every flag reviewed within 24 hours (NFR 4). |
| Every day | Admin | Check for new listener applications and suggested terms (the staff home shows both). |
| Twice a week | Owner | Firebase console > Usage: check reads and writes are well inside the free Spark plan's daily limits. About 30 people should use a small part of them. |
| Twice a week | Owner | Check that at least one trained listener is usually available. A request with nobody free gives up after 10 minutes. |
| When needed | Owner | A suspected data breach: follow [breach-procedure.md](breach-procedure.md) at once. |

A safety fix can be deployed during the pilot with `npm run deploy:pilot` from `main`. Scripts are served with no-cache, so it reaches everyone at once.

## 3. Measuring the pilot

The SRS sets four pilot goals (section 1, "The hypothesis of the solution"). Where each number comes from:

| Goal | Target | Where the data is | How to get it |
|---|---|---|---|
| People who had not looked for support before | At least half of pilot users | `accounts.firstTimeSeekingHelp`, asked once at sign-up (FR 1.6) | Count yes and no over all user accounts. |
| Feeling a little better after a chat | At least 60% of chats | `chats.moodBefore` and `chats.moodAfter` (FR 3.2) | Over ended chats that have both, count those where the mood after is higher than before. Also test whether the difference is real (the null hypothesis is that it is not). |
| Screening catches crisis and contact-sharing | At least 90% of each, in a test set | `docs/screening-report.md` | Already measured: met for crisis only with the model check, which the pilot does not use; not met for contact-sharing. Report this as it is. |
| Would use Spill again | At least 70% | `chats.useAgain`: "Would you use Spill again?" after each chat, answered `yes`, `no` or `not-sure` (optional) | Counted per chat, not per person, because the statistics hold no names. Report yes over every answer, and say how many answered "not sure". |

The admin's **Pilot statistics** page (`stats.html`, linked from the staff home) shows the first three goals and where each stands, plus the chats, people and safety counts behind them. It never reads chats: when a user ends a chat, a copy of only its topic, moods and answers is kept in `chatStats`, and each flag or report gets a count with only its kind in `safetyTally`. A share only shows once at least 5 people or chats are in it. Never report a number about one person.

Only chats where the user gave a mood at the end are counted. A chat ended by the listener first has no mood after it, so it is left out of the mood numbers.

## 4. After the pilot

- [ ] Owner: write up the four numbers above, and what the moderators and listeners saw.
- [ ] Owner: tell volunteers what happens to their data. Either delete the pilot data, or keep it only as long as the consent form says.
- [ ] Owner: to delete everything, delete each Auth account and the Firestore data in the console, or delete the `spill-pilot` project.
- [ ] Owner: switch off staff roles that are no longer needed (set `role` back to `user`).
