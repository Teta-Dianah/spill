# Spill

Spill is a free, anonymous peer-listener web app for young people aged 16 to 25 in Rwanda. You sign up with a pseudonym, do a quick mood check-in, and talk one-to-one with a vetted, trained volunteer listener. You never talk to other users, only to listeners, and every message is screened before it's delivered.

## Who it's for

Young Rwandans aged 16-25 who want a private, judgement-free place to talk about what's going on, whether that's exams, money, family, or just a rough day. Spill also works for anyone who isn't ready to sign up at all: the resources page (helplines, clinics, self-help tips) is open to visitors with no account.

## The problem

Rwanda has roughly one psychiatrist for every million people, and most young people who are struggling never reach any kind of support, largely because of stigma and cost. Spill isn't therapy and doesn't replace it. It's a low-friction first step, with a clear route to real local helplines and clinics when someone needs more than a listening ear.

The full requirements and reasoning live in [`docs/Spill_Proposal_and_SRS.pdf`](docs/Spill_Proposal_and_SRS.pdf).

## Tools and technologies

| Tool | What it's for |
|---|---|
| Firebase Hosting | Serves the web app; no separate backend server |
| Cloud Firestore | The database — accounts, moods, chats, messages, flags, reports, resources, audit log |
| Firebase Authentication | Handles sign-up, sign-in, and password hashing |
| Firestore Security Rules | Controls who can read/write what, throttles abuse, and screens messages at write time |
| Firebase Local Emulator Suite | Runs Firestore and Auth locally so tests don't touch the live project |
| Jest | Automated tests, including Security Rules tests |
| ESLint | Keeps the code style consistent |
| Node.js and npm | Runs the project's tooling and scripts |
| GitHub | Source control and the issue backlog |
| GitHub Projects | The [sprint board](https://github.com/users/Teta-Dianah/projects/4) |
| GitHub Actions | Runs tests on every push |

Everything runs on Firebase's free Spark plan — no billing account, no paid services.

## Sprint plan

8 weeks, 4 sprints. Full backlog is on the [Spill Sprint Board](https://github.com/users/Teta-Dianah/projects/4).

| Sprint | Weeks | Goal | What ships |
|---|---|---|---|
| 1 | 1-2 | Foundation | Repo and CI, pseudonymous sign-up, resources page, mood check-in |
| 2 | 3-4 | Talk to a listener | Listener matching queue, real-time chat |
| 3 | 5-6 | Make it safe | Message screening, report/block, moderator queue |
| 4 | 7-8 | Prove it and ship | Testing, deployment, demo |

## How message screening works

Every chat message is checked for crisis language and attempts to share contact details before it's delivered. This happens in two layers, on purpose (a third, the model check, is a demo prototype described further down):

- **`firestore.rules`** has its own small, fixed set of crisis and contact-sharing patterns, hardcoded and not editable without a redeploy. This is the real safety backstop — it's enforced at write time no matter what any client does, tampered or not.
- **`public/js/screening.js`** has a richer, normalised set of built-in term lists and contact-sharing patterns. This drives the actual chat experience (showing the crisis card promptly, warning messages about blocked contact-sharing attempts). It changes the app's behaviour, not what the database will actually accept.

### Admin-added terms (FR 7.1)

An admin can add, edit and remove extra terms for the crisis, abuse and contact lists on `admin-terms.html`, without a redeploy (for example, Kinyarwanda words). They're stored in `termLists/{crisis,abuse,contact}` as `{ terms: [...] }`, and the chat screen loads them once per chat.

- Admin terms are only ever **added** to the built-in lists. The built-in terms and contact patterns (phone numbers, emails, links, @handles, app names) always stay on, so an admin can't make screening weaker by mistake.
- Terms are plain text, not patterns. They're normalised the same way as messages (lower case, no accents or punctuation), must be 3 to 60 characters, and each list holds at most 200. Lists read from Firestore are cleaned again when loaded, so a bad saved value can't break screening.
- Any signed-in user can read the lists. Only an admin can write them, and `firestore.rules` refuses any change that doesn't come with its own new `auditLog` entry in the same write.
- If the lists can't be loaded, screening falls back to the built-in lists.

So an admin editing the term lists can make Spill *more* responsive to new phrasing, but can never turn off the underlying safety net in `firestore.rules`.

`test/unit/screening.test.js` measures `screenMessage()` against four sets (NFR 21):

- A 46-message labelled set, used while writing the built-in term lists and patterns.
- A held-out set of 16 messages never used while tuning, including Kinyarwanda and mixed Kinyarwanda/English.
- A second set of 47 messages (`test/data/screening-held-out-2.txt`): 14 crisis, 9 abuse, 10 contact and 14 normal, in Kinyarwanda, English and mixed. It was held out for its first run only. The seed terms were then changed based on its misses and false positives, so **it is now tuned after this change** and its current numbers are not held-out results.
- A third set of 42 messages (`test/data/screening-held-out-3.txt`): 15 crisis, 6 abuse, 8 contact and 13 normal, mostly informal English plus Kinyarwanda and mixed. It is **held-out**: it was run once, after the term fixes above, and no term or rule was changed for it.

Each set is scored with the built-in lists only ("before") and with the terms in `scripts/term-lists-seed.json` added ("after"). Precision (P) and recall (R), before → after:

| Set | Crisis | Contact | Abuse |
|---|---|---|---|
| Tuned set (46) | P 1.00 → 1.00, R 1.00 → 1.00 | P 1.00 → 1.00, R 1.00 → 1.00 | P 1.00 → 1.00, R 1.00 → 1.00 |
| Previous held-out (16) | P 1.00 → 1.00, R 0.13 → 0.38 | P 1.00 → 1.00, R 1.00 → 1.00 | P 1.00 → 1.00, R 0.00 → 0.50 |
| Second set (47), first run, held-out | P n/a → 1.00, R 0.00 → 0.64 | P 1.00 → 1.00, R 0.60 → 0.90 | P 1.00 → 0.82, R 0.44 → 1.00 |
| Second set (47), tuned after this change | P n/a → 1.00, R 0.00 → 1.00 | P 1.00 → 1.00, R 0.60 → 0.90 | P 1.00 → 1.00, R 0.44 → 1.00 |
| Third set (42), held-out | P 1.00 → 0.50, R 0.07 → 0.13 | P 1.00 → 1.00, R 0.63 → 0.63 | P n/a → n/a, R 0.00 → 0.00 |

"n/a" means nothing in that category was flagged, so there is no precision to measure. The third set's misses and false positives are printed in full by `npm test`.

The first-run row is the honest held-out result for the second set. After that run, "kwipfira" and seven English crisis phrases were added ("point in going on", "better off without me", "end it all", "ending it all", "disappear forever", "never wake up", "life has no worth"), and "nzakubona" and "va hano" were removed from the abuse list because they matched everyday messages ("Nzakubona ejo", "Kuva hano"). The tuned row only shows that those changes did what they were meant to. A fresh, unseen set is needed for a new held-out number.

On the second set, after the change, one message is still missed: "njye nagufasha muri uwo mubabaro uzaze unsure that i also give you some money" (see below). Matching is literal, so the English phrases were added in the forms the set used: "point in going on" rather than "no point in going on" (the message says "the point"), and "ending it all" next to "end it all".

Most Kinyarwanda messages in this set use the seed phrases word for word, so their perfect Kinyarwanda recall shows the terms work when the phrasing matches, not that they generalise.

### Known limit of term matching

Term matching only finds a listed phrase written the same way. It can't see what a message *means*. The contact message above, roughly "I can help you with that pain, come and see me, and I'll also give you some money", is an attempt to meet in person with an offer of money, which is a grooming pattern. But it uses no listed phrase, no phone number, link or platform name, and its words ("uzaze", "unsure", "give you some money") are too common to add as terms without blocking everyday messages. So it gets through. Adding more phrases can't fully close this kind of gap. That's why the report and block buttons, the moderator queue and listener training still matter for these cases.

These gaps are the phrase-list limitation the SRS already documents (section 2.5), not a bug: reworded text rarely matches a fixed phrase list. `firestore.rules` stays the actual backstop regardless of what this file catches.

### Model check (demo prototype)

Because term matching can't see meaning, Spill has a third layer that can: after a message is sent, the chat page can ask an AI service (Google Gemini, through Firebase AI Logic) to rate it for crisis and abuse. **This is a demo prototype. It is not ready for real users, and nothing here claims it is safe for them.**

How it works:

- The message is screened by the term lists and delivered exactly as before. Nothing waits for the model.
- Straight afterwards, the page asks the model to rate the message from 0 to 3 for crisis and for abuse. A 2 or 3 counts.
- The answer can only **add** a crisis or abuse flag for the moderators. For crisis, the sender is also shown the crisis card. It never blocks a message and never removes a flag.
- If the model is off, fails, is rate-limited or takes longer than 20 seconds, nothing changes: the term lists and `firestore.rules` alone stand.
- Messages blocked for contact-sharing, and messages the term lists already flag as crisis, are never sent to the model.

It is off by default. It runs only when both of these are true:

1. `public/js/firebase-config.js` sets `modelCheckEnabled` to `true`. The template sets it to `false`.
2. The project is on the list in `public/js/model-check-settings.js`, which holds only the development project. The setting is ignored for any other project, so the model check can't turn itself on anywhere else.

So it is off on the emulators, in CI and in the pilot project, and on only in the development project, for the demo.

When it is on, a small "Safety check" notice is shown once, before the person's first chat, with "Agree" and "No thanks": to a user on `request-chat.html` and to a listener on `listener-dashboard.html`. The choice is remembered in that browser for that account. The chat works the same either way. Each side answers for their own messages only: a listener who agreed has their messages checked exactly like a user's (after sending, flags only), whatever the user in that chat chose, and the other way round. For anyone who has not answered or said no, screening is the term lists and `firestore.rules` alone. When the model check is off, the notice never appears.

On the third set, which is held-out, the term lists caught 2 of the 15 crisis messages. The model, measured separately on the same 42 messages, caught all 15 with no false alarms. The set is small, so this shows the gap the model can close, not a guaranteed rate.

**Before any real user's messages go through it, the project needs:**

- **A provider or terms that fit Spill's users.** The prototype uses Google's free tier. Its terms require users to be 18 or older, say not to submit sensitive or personal information, and allow Google to use the messages to improve its products, including review by people. Spill's users are 16 to 25 and their messages are sensitive, so the free tier can't be used for them.
- **A proper consent step.** The notice is a first version. Real use needs consent that fits Rwanda's data protection law and the legal review in NFR 14, kept with the account rather than in the browser.
- **App Check.** Google is making it a requirement for this service. Without it the model check stops working after 21 January 2027, and screening goes back to the term lists alone.

**If you are testing the demo, use made-up messages only.** Don't type anything real or personal while the model check is on.

Two more limits to know about: the model's flag is written a few seconds after the message, not in the same write as it, and it is lost if the sender closes the page before the answer arrives. `docs/SRS_change_notes.md` lists where this differs from the SRS.

## How matching avoids duplicate requests

A user can only ever have one pending chat request outstanding (FR 4.1). `request-chat.js` claims a `pendingChats/{uid}` marker in the same atomic batch as the `chats` document it creates, and `firestore.rules` requires that pairing on every chat create — since `pendingChats` has no update rule, a second chat can never get its own claim while the first one's still stands.

Whether nobody's free right now or the matched listener declines, the user sees the identical wait status and the search retries automatically, giving up after 10 minutes of nobody being free. The marker is released whenever the search genuinely ends — matched, declined (then re-claimed for the retry), cancelled by the user, given up on, or found stale (older than that same 10 minutes) the next time the page loads — so a user is never locked out of starting a fresh request, even after an abandoned tab or a browser crash.

## Setup

You'll need Node.js 20 or newer and a JDK 21 or newer (the Firebase emulators run on Java).

The app's code is on the `develop` branch until it is merged into `main`.

```bash
npm install
```

Copy `public/js/firebase-config.example.js` to `public/js/firebase-config.js`. That file is gitignored, so it never gets committed. The copy works with the local emulators as it is: its `projectId` is `demo-spill-dev`, an emulator-only project, and the emulators never check the other values. Fill in real values only when you connect to a real Firebase project. Leave `modelCheckEnabled` as `false`; see "Model check (demo prototype)" above.

## Running locally

```bash
npm run emulators
```

This starts the Firestore and Auth emulators plus Hosting, serving the app at `http://localhost:5000`. The emulator UI (for inspecting data) is at `http://localhost:4000`. Everything stays on your computer and is wiped when the emulators stop.

Then, in another terminal while the emulators are running, add the sample data:

```bash
npm run seed            # sample helplines and clinics for the resources page
npm run seed:terms      # starter screening terms (FR 7.1)
npm run seed:accounts   # one demo account per role
```

### Demo accounts

Sign-up only ever creates an ordinary user, so `npm run seed:accounts` creates one account for each role. They all use the password `spill-demo-123`.

| Role | Email | What to try |
|---|---|---|
| User | `user@spill.test` | Mood check-in, "Talk to a listener" |
| Listener | `listener@spill.test` | Listener dashboard: accept a chat request. Already approved, trained and available |
| Moderator | `moderator@spill.test` | Moderator queue: open a case, record an action |
| Admin | `admin@spill.test` | Listener applications, screening terms, helplines and clinics |

These accounts are for the emulators only. The script uses the emulator-only project and refuses to run if it is pointed at anything other than the emulators on your computer. Never create accounts with a published password in a real Firebase project.

### Pages

| Page | Address | Who can use it |
|---|---|---|
| Resources and crisis card | `/` | Anyone, no account |
| Sign up, sign in | `/signup.html`, `/signin.html` | Anyone |
| Dashboard | `/dashboard.html` | Any signed-in account |
| Talk to a listener | `/request-chat.html` | User |
| Chat | `/chat.html` (opened from a request or the listener dashboard) | The two people in the chat |
| Apply as a listener | `/listener-apply.html` | User |
| Listener dashboard, training | `/listener-dashboard.html`, `/listener-training.html` | Listener |
| Moderator queue, case view | `/moderator-queue.html`, `/moderator-case.html` | Moderator |
| Admin pages | `/admin-listeners.html`, `/admin-terms.html`, `/admin-resources.html` | Admin |

To reach the staff pages, sign in and look at the dashboard. An approved listener, a moderator or an admin sees a "Your Spill pages" section there with links to their own pages. An ordinary user doesn't see it, and no public page links to a staff page. The links are only a shortcut: `firestore.rules` decides who can read or change anything, so opening a staff page's address without the role shows nothing.

### Trying a chat

1. In one browser window, sign in as the listener and open the listener dashboard.
2. In a private window (or another browser), sign in as the user and choose "Talk to a listener".
3. Accept the request on the listener dashboard, then open the chat from "Your active chats".
4. Send an ordinary message, then a crisis one (for example "I want to kill myself") to see the crisis card, then one with a phone number to see it blocked.
5. Sign in as the moderator to see both flags in the queue.

### About the seed scripts

`npm run seed:terms` adds the terms in `scripts/term-lists-seed.json` (mostly Kinyarwanda, plus a few English crisis phrases) to the admin term lists. Each term goes through the same checks as `admin-terms.html`, and each one added gets its own `auditLog` entry. Terms already on a list are skipped, so it's safe to run again. The script only adds terms: removing a term from the seed file doesn't remove it from a database that was already seeded. Remove it on `admin-terms.html` instead, so the removal is logged too.

All three seed scripts write to the emulators only.

## Testing

```bash
npm test
```

This starts the Firestore emulator, runs every test (the unit tests and the Firestore Security Rules tests) and stops the emulator again. Stop `npm run emulators` first if it is running, because both use the same port.

To run only the unit tests, which need no emulator:

```bash
npm run test:unit
```

## Linting

```bash
npm run lint
```

## Deployment

Spill deploys to Firebase Hosting and Cloud Firestore on the free Spark plan. `.firebaserc` names two projects: `dev` (development) and `pilot`. Nothing below needs a key or secret in the repository.

**One-time setup in the Firebase console, per project**

1. Authentication > Sign-in method: turn on Email/Password.
2. Firestore Database: create the database.
3. Authentication > Settings > Authorised domains: check the Hosting domain (`<project-id>.web.app`) is listed.
4. Project settings > General > Your apps: copy the web app's config values into your local `public/js/firebase-config.js`. The file is gitignored; it is uploaded with the site but never committed.

**Deploy**

```bash
npx firebase login
npx firebase use dev
npm test
npm run lint
npx firebase deploy --only hosting,firestore
```

`--only hosting,firestore` uploads the `public/` folder, `firestore.rules` and the indexes in `firestore.indexes.json`. To deploy one part only, use `--only hosting`, `--only firestore:rules` or `--only firestore:indexes`.

Check which project `public/js/firebase-config.js` points at before every deploy: the site talks to whichever project that file names, not the one chosen with `firebase use`.

**After the first deploy**

- **Staff accounts.** Sign up on the deployed site with each person's own email and a private password. Then, in the Firebase console, open Firestore > `accounts` > that person's document and change `role` to `moderator` or `admin`. A listener applies on `listener-apply.html` and is approved by an admin on `admin-listeners.html`. Don't run `npm run seed:accounts` here: it refuses, and its password is public.
- **Helplines and clinics.** An admin adds the verified ones on `admin-resources.html`.
- **Screening terms.** The seed scripts write to the emulators only. On a deployed project an admin adds the terms from `scripts/term-lists-seed.json` on `admin-terms.html`, which logs each one. Until then screening uses the built-in lists and the fixed patterns in `firestore.rules`.

`firebase.json` sets `Cache-Control: no-cache` on every `.js` and `.css` file, so a deploy that fixes a safety bug (screening, chat) takes effect immediately for everyone instead of waiting out a browser's cached copy. This only applies on a real deploy — the local Hosting emulator doesn't implement custom headers, so you won't see it in `curl` or dev tools while running `npm run emulators`.

## A note on what Spill is not

Spill offers peer support, not therapy, and it's not an emergency service — the "Need help now" button on every page points to real local helplines and clinics for that. The pilot runs on Firebase's free tier with test data and consenting adult volunteers only; it does not yet collect or store real user data, pending the legal review required under Rwanda's data protection law.
