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

Every chat message is checked for crisis language and attempts to share contact details before it's delivered. This happens in two layers, on purpose:

- **`firestore.rules`** has its own small, fixed set of crisis and contact-sharing patterns, hardcoded and not editable without a redeploy. This is the real safety backstop — it's enforced at write time no matter what any client does, tampered or not.
- **`public/js/screening.js`** has a richer, normalised set of built-in term lists and contact-sharing patterns. This drives the actual chat experience (showing the crisis card promptly, warning messages about blocked contact-sharing attempts). It changes the app's behaviour, not what the database will actually accept.

### Admin-added terms (FR 7.1)

An admin can add, edit and remove extra terms for the crisis, abuse and contact lists on `admin-terms.html`, without a redeploy (for example, Kinyarwanda words). They're stored in `termLists/{crisis,abuse,contact}` as `{ terms: [...] }`, and the chat screen loads them once per chat.

- Admin terms are only ever **added** to the built-in lists. The built-in terms and contact patterns (phone numbers, emails, links, @handles, app names) always stay on, so an admin can't make screening weaker by mistake.
- Terms are plain text, not patterns. They're normalised the same way as messages (lower case, no accents or punctuation), must be 3 to 60 characters, and each list holds at most 200. Lists read from Firestore are cleaned again when loaded, so a bad saved value can't break screening.
- Any signed-in user can read the lists. Only an admin can write them, and `firestore.rules` refuses any change that doesn't come with its own new `auditLog` entry in the same write.
- If the lists can't be loaded, screening falls back to the built-in lists.

So an admin editing the term lists can make Spill *more* responsive to new phrasing, but can never turn off the underlying safety net in `firestore.rules`.

`test/unit/screening.test.js` measures `screenMessage()` against three sets (NFR 21):

- A 45-message labelled set, used while writing the built-in term lists and patterns.
- A held-out set of 16 messages never used while tuning, including Kinyarwanda and mixed Kinyarwanda/English.
- A second set of 47 messages (`test/data/screening-held-out-2.txt`): 14 crisis, 9 abuse, 10 contact and 14 normal, in Kinyarwanda, English and mixed. It was held out for its first run only. The seed terms were then changed based on its misses and false positives, so **it is now tuned after this change** and its current numbers are not held-out results.

Each set is scored with the built-in lists only ("before") and with the terms in `scripts/term-lists-seed.json` added ("after"). Precision (P) and recall (R), before → after:

| Set | Crisis | Contact | Abuse |
|---|---|---|---|
| Tuned set (45) | P 1.00 → 1.00, R 1.00 → 1.00 | P 1.00 → 1.00, R 1.00 → 1.00 | P 1.00 → 1.00, R 1.00 → 1.00 |
| Previous held-out (16) | P 1.00 → 1.00, R 0.13 → 0.38 | P 1.00 → 1.00, R 1.00 → 1.00 | P 1.00 → 1.00, R 0.00 → 0.50 |
| Second set (47), first run, held-out | P n/a → 1.00, R 0.00 → 0.64 | P 1.00 → 1.00, R 0.60 → 0.90 | P 1.00 → 0.82, R 0.44 → 1.00 |
| Second set (47), tuned after this change | P n/a → 1.00, R 0.00 → 1.00 | P 1.00 → 1.00, R 0.60 → 0.90 | P 1.00 → 1.00, R 0.44 → 1.00 |

The first-run row is the honest held-out result for the second set. After that run, "kwipfira" and seven English crisis phrases were added ("point in going on", "better off without me", "end it all", "ending it all", "disappear forever", "never wake up", "life has no worth"), and "nzakubona" and "va hano" were removed from the abuse list because they matched everyday messages ("Nzakubona ejo", "Kuva hano"). The tuned row only shows that those changes did what they were meant to. A fresh, unseen set is needed for a new held-out number.

On the second set, after the change, one message is still missed: "njye nagufasha muri uwo mubabaro uzaze unsure that i also give you some money" (see below). Matching is literal, so the English phrases were added in the forms the set used: "point in going on" rather than "no point in going on" (the message says "the point"), and "ending it all" next to "end it all".

Most Kinyarwanda messages in this set use the seed phrases word for word, so their perfect Kinyarwanda recall shows the terms work when the phrasing matches, not that they generalise.

### Known limit of term matching

Term matching only finds a listed phrase written the same way. It can't see what a message *means*. The contact message above, roughly "I can help you with that pain, come and see me, and I'll also give you some money", is an attempt to meet in person with an offer of money, which is a grooming pattern. But it uses no listed phrase, no phone number, link or platform name, and its words ("uzaze", "unsure", "give you some money") are too common to add as terms without blocking everyday messages. So it gets through. Adding more phrases can't fully close this kind of gap. That's why the report and block buttons, the moderator queue and listener training still matter for these cases.

These gaps are the phrase-list limitation the SRS already documents (section 2.5), not a bug: reworded text rarely matches a fixed phrase list. `firestore.rules` stays the actual backstop regardless of what this file catches.

## How matching avoids duplicate requests

A user can only ever have one pending chat request outstanding (FR 4.1). `request-chat.js` claims a `pendingChats/{uid}` marker in the same atomic batch as the `chats` document it creates, and `firestore.rules` requires that pairing on every chat create — since `pendingChats` has no update rule, a second chat can never get its own claim while the first one's still stands.

Whether nobody's free right now or the matched listener declines, the user sees the identical wait status and the search retries automatically, giving up after 10 minutes of nobody being free. The marker is released whenever the search genuinely ends — matched, declined (then re-claimed for the retry), cancelled by the user, given up on, or found stale (older than that same 10 minutes) the next time the page loads — so a user is never locked out of starting a fresh request, even after an abandoned tab or a browser crash.

## Setup

You'll need Node.js and a JDK 21 or newer (the Firebase emulators run on Java).

```bash
npm install
```

Copy `public/js/firebase-config.example.js` to `public/js/firebase-config.js`. That file is gitignored, so it never gets committed. For local development against the emulators, set `projectId` to `demo-spill-dev` and leave the other values as placeholders: the emulators never check them. Fill in real values only when you connect to a real Firebase project.

## Running locally

```bash
npm run emulators
```

This starts the Firestore and Auth emulators plus Hosting, serving the app at `http://localhost:5000`. The emulator UI (for inspecting data) is at `http://localhost:4000`.

To add some sample helplines and clinics to try the resources page, run in another terminal while the emulators are running:

```bash
npm run seed
```

To add the starter screening terms in `scripts/term-lists-seed.json` (mostly Kinyarwanda, plus a few English crisis phrases) to the admin term lists (FR 7.1):

```bash
npm run seed:terms
```

Each term goes through the same checks as `admin-terms.html`, and each one added gets its own `auditLog` entry. Terms already on a list are skipped, so it's safe to run again. The script only adds terms: removing a term from the seed file doesn't remove it from a database that was already seeded. Remove it on `admin-terms.html` instead, so the removal is logged too.

## Testing

```bash
npm test
```

This runs the plain Jest unit tests. The Firestore Security Rules tests need the emulator running first:

```bash
npx firebase emulators:exec --project demo-spill-dev "npm test"
```

## Linting

```bash
npm run lint
```

## Deployment

_To be filled in during Sprint 4._

```bash
firebase deploy
```

`firebase.json` sets `Cache-Control: no-cache` on every `.js` and `.css` file, so a deploy that fixes a safety bug (screening, chat) takes effect immediately for everyone instead of waiting out a browser's cached copy. This only applies on a real deploy — the local Hosting emulator doesn't implement custom headers, so you won't see it in `curl` or dev tools while running `npm run emulators`.

## A note on what Spill is not

Spill offers peer support, not therapy, and it's not an emergency service — the "Need help now" button on every page points to real local helplines and clinics for that. The pilot runs on Firebase's free tier with test data and consenting adult volunteers only; it does not yet collect or store real user data, pending the legal review required under Rwanda's data protection law.
