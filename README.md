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
| Cloud Firestore | The database. From the SRS: accounts, moods, chats, messages, flags, reports, resources, audit log. Added since: `listeners` (listener applications and availability), `termLists` and `termSuggestions` (the screening term lists and moderators' suggestions for them), `chatStats` and `safetyTally` (content-free copies for the admin's anonymised statistics), and three marker collections that hold no chat content: `chatFlagged`, `chatCases` and `pendingChats` |
| Firebase Authentication | Handles sign-up, sign-in, and password hashing |
| Firestore Security Rules | Controls who can read/write what, throttles abuse, and screens messages at write time |
| Firebase Local Emulator Suite | Runs Firestore and Auth locally so tests don't touch the live project |
| Jest | Automated tests, including Security Rules tests |
| ESLint | Keeps the code style consistent |
| Node.js and npm | Runs the project's tooling and scripts |
| GitHub | Source control and the issue backlog |
| GitHub Projects | The [sprint board](https://github.com/users/Teta-Dianah/projects/4) |
| GitHub Actions | Runs tests on every push |
| Firebase AI Logic (Google Gemini) | The outside service behind the model check, a demo prototype that is off by default. The only part of Spill that sends anything outside Firebase's own database and sign-in |

Everything runs on Firebase's free Spark plan, with no billing account and no paid services. The model check uses the service's free tier.

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

- **`firestore.rules`** has its own small, fixed set of crisis and contact-sharing patterns, hardcoded and not editable without a redeploy. This is the real safety backstop: it's enforced at write time no matter what any client does, tampered or not.
- **`public/js/screening.js`** has a richer, normalised set of built-in term lists and contact-sharing patterns. This drives the actual chat experience (showing the crisis card promptly, warning messages about blocked contact-sharing attempts). It changes the app's behaviour, not what the database will actually accept.

### Admin-added terms (FR 7.1)

An admin can add, edit and remove extra terms for the crisis, abuse and contact lists on `admin-terms.html`, without a redeploy (for example, Kinyarwanda words). The "Import starter terms" button there adds Spill's starter terms in one go; it only ever adds, and skips terms already listed. They're stored in `termLists/{crisis,abuse,contact}` as `{ terms: [...] }`, and the chat screen loads them once per chat.

- Admin terms are only ever **added** to the built-in lists. The built-in terms and contact patterns (phone numbers, emails, links, @handles, app names) always stay on, so an admin can't make screening weaker by mistake.
- Terms are plain text, not patterns. They're normalised the same way as messages (lower case, no accents or punctuation), must be 3 to 60 characters, and each list holds at most 200. Lists read from Firestore are cleaned again when loaded, so a bad saved value can't break screening.
- Any signed-in user can read the lists. Only an admin can write them, and `firestore.rules` refuses any change that doesn't come with its own new `auditLog` entry in the same write.
- If the lists can't be loaded, screening falls back to the built-in lists.

So an admin editing the term lists can make Spill *more* responsive to new phrasing, but can never turn off the underlying safety net in `firestore.rules`.

### Moderator-suggested terms (FR 7.1)

Flags are how Spill finds out what its term lists miss. A moderator reviewing a flagged chat can pass that on, but a term only ever reaches a list through a person and an approval step:

**flag → moderator suggests → admin approves → list grows**

1. A flag or report reaches the moderator queue. It can come from the Rules, the term lists, the model check or a person pressing Report.
2. On the case page, the moderator fills in "Suggest a term": a short phrase (3 to 60 characters), crisis or abusive language, and an optional note. The page reminds them to use a short phrase that would not appear in harmless messages.
3. On `admin-terms.html`, an admin sees the pending suggestions and presses Approve or Reject.
4. Approve adds the phrase to its term list, marks the suggestion approved and writes an `auditLog` entry, all in one write. Reject marks it rejected, with its own `auditLog` entry.

What keeps this safe:

- **Nothing is added automatically.** No flag, and no answer from the model check, can change a term list. Only an admin's Approve does.
- **A suggestion holds no chat content.** It stores the phrase, the category, the note, the moderator's own ID and a time. The moderator types the phrase by hand; no message text and no user ID is copied in, and `firestore.rules` refuses any other field.
- **Additions only.** Approve uses the same logic as the admin's own "Add" form. It can't remove or change a term, and the built-in terms stay on.
- **No contact terms.** A contact term stops a message being sent, so those stay with the admin.
- **The admin is warned** when a phrase is under 6 characters or a single word. Matching ignores word breaks, so "ass" would also match "classic".
- **Enforced in `firestore.rules`.** Only a moderator can create a suggestion, under their own ID, and can read only their own. Only an admin can review one, once, and only together with a new `auditLog` entry; an approval must also really put the phrase on the list. The author can't edit a suggestion, nobody can delete one, and users and listeners can't read or write them at all.

`test/unit/screening.test.js` measures `screenMessage()` against four sets (NFR 21), kept in `test/screening-sets.js` and `test/data/`. The full results, including the model check, are in [docs/screening-report.md](docs/screening-report.md).

- A 46-message labelled set, used while writing the built-in term lists and patterns.
- A held-out set of 16 messages never used while tuning, including Kinyarwanda and mixed Kinyarwanda/English.
- A second set of 47 messages (`test/data/screening-held-out-2.txt`): 14 crisis, 9 abuse, 10 contact and 14 normal, in Kinyarwanda, English and mixed. It was held out for its first run only. The seed terms were then changed based on its misses and false positives, so **it is now tuned after this change** and its current numbers are not held-out results.
- A third set of 42 messages (`test/data/screening-held-out-3.txt`): 15 crisis, 6 abuse, 8 contact and 13 normal, mostly informal English plus Kinyarwanda and mixed. It is **held-out**: it was run once, after the term fixes above, and no term or rule was changed for it.

Each set is scored with the built-in lists only ("before") and with the terms in `public/data/term-lists-seed.json` added ("after"). Precision (P) and recall (R), before → after:

| Set | Crisis | Contact | Abuse |
|---|---|---|---|
| Tuned set (46) | P 1.00 → 1.00, R 1.00 → 1.00 | P 1.00 → 1.00, R 1.00 → 1.00 | P 1.00 → 1.00, R 1.00 → 1.00 |
| Previous held-out (16) | P 1.00 → 1.00, R 0.13 → 0.38 | P 1.00 → 1.00, R 1.00 → 1.00 | P 1.00 → 1.00, R 0.00 → 0.50 |
| Second set (47), first run, held-out | P n/a → 1.00, R 0.00 → 0.64 | P 1.00 → 1.00, R 0.60 → 0.90 | P 1.00 → 0.82, R 0.44 → 1.00 |
| Second set (47), tuned after this change | P n/a → 1.00, R 0.00 → 1.00 | P 1.00 → 1.00, R 0.60 → 0.90 | P 1.00 → 1.00, R 0.44 → 1.00 |
| Third set (42), held-out | P 1.00 → 0.50, R 0.07 → 0.13 | P 1.00 → 1.00, R 0.63 → 0.63 | P n/a → n/a, R 0.00 → 0.00 |

"n/a" means nothing in that category was flagged, so there is no precision to measure. The third set's misses and false positives are printed in full by `npm test`, and listed in the screening report.

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
- **App Check.** App Check is **not set up** in Spill. Google requires it for this service, so in the development project its enforcement for this one service has been switched off by hand in the Firebase console. Google has delayed the requirement, but only until 21 January 2027 at the latest. So App Check must be set up before any real use, or before that date, whichever comes first. If it is not, the model check stops working and screening goes back to the term lists and `firestore.rules` alone. It was left out because the prototype is only used for the demo, with made-up messages.

**If you are testing the demo, use made-up messages only.** Don't type anything real or personal while the model check is on.

Two more limits to know about: the model's flag is written a few seconds after the message, not in the same write as it, and it is lost if the sender closes the page before the answer arrives. `docs/SRS_change_notes.md` lists where this differs from the SRS.

## Privacy and the law (NFR 14)

Spill follows Rwanda's data protection law, Law No. 058/2021, as far as a prototype can. Spill handles sensitive data (people's mental health), so:

- **Nobody under 16 can join.** Sign-up offers "Under 16", which makes no account and points to the helplines. `firestore.rules` refuses any age band but 16 to 17 and 18 to 25, and an owner can't change their age band afterwards.
- **The privacy notice and terms** are at `privacy.html`, linked from sign-up, the landing page and the dashboard. Each new account records which version was agreed to and when (`privacyNoticeVersion`, `consentedAt`), and the Rules refuse an account without them. If you change `privacy.html` in a way people should agree to again, change `PRIVACY_NOTICE_VERSION` in `public/js/auth.js` and the version on the page; a test checks they match.
- **Accounts hold only known fields,** so no real name, phone number or other detail can be stored (NFR 11).
- **If data may have leaked,** follow [docs/breach-procedure.md](docs/breach-procedure.md): it must be reported to the National Cyber Security Authority within 48 hours. `firestore.lockdown.rules` shuts off every read and write except the public helplines in one deploy.

[docs/legal-privacy-checklist.md](docs/legal-privacy-checklist.md) lists each legal item and its status. Some need decisions outside the app. The main one is that the data is stored outside Rwanda (the development database is in South Africa), which is why Spill is only used with test data and adult volunteers for now.

## How someone becomes a listener (FR 5.1, FR 5.2)

Users only ever talk to vetted listeners, so becoming one takes more than filling in a form. Every listener must be 21 or older.

**application → in-person checks → approval → training → ready**

1. **Application.** On `listener-apply.html` the person confirms they are 21 or older, says why they want to listen, what experience they have and how much time they can give, answers two "what would you do" situations, and agrees to the code of conduct and to the in-person checks. An account in the 16 to 17 age band can't apply.
2. **Reference code.** They get a code such as `SPL-7K2QXD`. They quote it when they write to the coordinator to arrange the checks, so their name never has to be stored.
3. **In-person checks.** A coordinator sees their identity document and police clearance certificate, contacts two references and holds a short interview.
4. **Approval.** On `admin-listeners.html` an admin reads the answers and ticks each check as it is done. Approve only works once all four are ticked. Reject needs a reason.
5. **Training.** The approved listener passes the training quiz and can then set themselves available.

What keeps this honest and private:

- **Nothing is uploaded.** Spill never stores a real name, a phone number or an identity document (NFR 11). It records only that each check was done, and by which admin.
- **The answers are private.** They are kept in `listenerApplications/{uid}`, which only the applicant and an admin can read. The `listeners/{uid}` record that every signed-in user can read (matching happens in the browser) holds no answers.
- **The applicant can take their answers back.** While the application is still waiting they can withdraw it, which removes their answers, and apply again later. Deleting an account removes the application with it, along with the person's mood history. Once an admin has approved or rejected, it can only be removed along with the account, so a rejected person can't wipe the decision and start again.
- **Enforced in `firestore.rules`.** A listener can't be approved until all four checks are saved. A rejection needs a recorded reason. Every admin step needs its own new `auditLog` entry in the same write (FR 6.9). An applicant can't change their application or tick their own checks.

The coordinator's address is `VETTING_CONTACT_EMAIL` at the top of `public/js/listener-application.js`. For now it is the project owner's address. Change it there if someone else takes over as coordinator.

## Design

The look is meant to feel like a place to talk, not a clinic: confident on the way in (heavy headlines, a warm background, one orange accent) and quiet on the screens where people open up (soft message bubbles in the chat, a calm crisis card). The wording stays plain and non-clinical.

Everything visual lives in `public/css/styles.css`. The pages carry no inline styles.

- **One scale for type, spacing and colour**, set as variables at the top of the stylesheet.
- **Mobile first.** Pages work from 320 px wide and open into two columns on wider screens. Text wraps instead of overlapping, and nothing scrolls sideways.
- **"Need help now" is fixed on every page** (NFR 5). Each page keeps empty space at the bottom, so the button never covers the last thing on it.
- **Colour has one job each.** Orange marks the one main action on a screen. Red is only for "Need help now" and for actions that remove something.
- **Easy to tap and to read.** Buttons, fields and standalone links are at least 44 px tall, keyboard focus is always visible, and severity in the moderator queue is written out as well as coloured.
- **Tap, don't open a dropdown.** Mood, topic and age are groups of radio buttons styled as boxes. The scripts still read them with `form.<name>.value`.
- **Fonts are served from the app.** Archivo and Archivo Black are in `public/fonts/` under the SIL Open Font License (`public/fonts/OFL.txt`). No page asks another site for a font, so opening Spill tells no outside font service about it.

`test/unit/pages.test.js` checks the parts of this that can be checked from the files: every page loads the "Need help now" button and the stylesheet, has no inline styles, and asks no other site for fonts.

## How matching avoids duplicate requests

A user can only ever have one pending chat request outstanding (FR 4.1). `request-chat.js` claims a `pendingChats/{uid}` marker in the same atomic batch as the `chats` document it creates, and `firestore.rules` requires that pairing on every chat create. Since `pendingChats` has no update rule, a second chat can never get its own claim while the first one's still stands.

Whether nobody's free right now or the matched listener declines, the user sees the identical wait status and the search retries automatically, giving up after 10 minutes of nobody being free. The marker is released whenever the search genuinely ends (matched, declined and then re-claimed for the retry, cancelled by the user, given up on, or found stale, older than that same 10 minutes, the next time the page loads), so a user is never locked out of starting a fresh request, even after an abandoned tab or a browser crash.

## Setup

You'll need Node.js 20 or newer and a JDK 21 or newer (the Firebase emulators run on Java).

The code is on `main`, the default branch, so a plain `git clone` gets everything.

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
| User | `user@spill.test` | Mood check-in, "Talk to a listener", "Apply to be a listener" |
| Listener | `listener@spill.test` | Listener dashboard: accept a chat request. Already approved, trained and available |
| Moderator | `moderator@spill.test` | Moderator queue: open a case, record an action, suggest a term |
| Admin | `admin@spill.test` | Listener applications (apply as the user first, then tick the checks and approve), screening terms (one demo suggestion is waiting to approve or reject), helplines and clinics |

These accounts are for the emulators only. The script uses the emulator-only project and refuses to run if it is pointed at anything other than the emulators on your computer. Never create accounts with a published password in a real Firebase project.

### Pages

| Page | Address | Who can use it |
|---|---|---|
| Resources and crisis card | `/` | Anyone, no account |
| Sign up, sign in | `/signup.html`, `/signin.html` | Anyone |
| Dashboard | `/dashboard.html` | Any signed-in account |
| Staff home | `/staff.html` | Moderator, admin |
| Pilot statistics | `/stats.html` | Admin |
| Talk to a listener | `/request-chat.html` | User |
| Chat | `/chat.html` (opened from a request or the listener dashboard) | The two people in the chat |
| Apply as a listener | `/listener-apply.html` | User |
| Listener dashboard, training | `/listener-dashboard.html`, `/listener-training.html` | Listener |
| Moderator queue, case view | `/moderator-queue.html`, `/moderator-case.html` | Moderator |
| Admin pages | `/admin-listeners.html`, `/admin-terms.html`, `/admin-resources.html` | Admin |

After signing in, each person lands on their own home page: a user on the dashboard, an approved listener on the listener dashboard, and a moderator or admin on `staff.html`. Each home page opens with a row of numbers showing what is waiting, then the items themselves, each one a tap away:

| Who | Numbers at the top | Then |
|---|---|---|
| User | Check-ins this month, average mood, last check-in | Their open chat (if any), the check-in form, and their mood lately |
| Listener | Requests waiting, active chats out of 2, available or away, training | Requests to accept or decline, their status, and active chats |
| Moderator | Crisis flags, other flags, reports, how long the oldest has waited | The five most serious open items, and their own recent actions |
| Admin | Applications waiting, suggested terms waiting, approved listeners, listeners available now | The waiting applications and suggested terms, and their own recent actions |

A number that needs attention now (a crisis flag, a request waiting) is shown in orange, and its label always says what it is. No home page shows any chat message text. The counting and wording live in `public/js/home-summary.js`, which has its own unit tests. Every home page links back to the personal dashboard.

To reach the staff pages later, sign in and look at the dashboard. An approved listener, a moderator or an admin sees a "Your Spill pages" section there with links to their own pages. An ordinary user doesn't see it, and no public page links to a staff page. The links are only a shortcut: `firestore.rules` decides who can read or change anything, so opening a staff page's address without the role shows nothing.

### Trying a chat

1. In one browser window, sign in as the listener and open the listener dashboard.
2. In a private window (or another browser), sign in as the user and choose "Talk to a listener".
3. Accept the request on the listener dashboard, then open the chat from "Your active chats".
4. Send an ordinary message, then a crisis one (for example "I want to kill myself") to see the crisis card, then one with a phone number to see it blocked.
5. Sign in as the moderator to see both flags in the queue.

### About the seed scripts

`npm run seed:terms` adds the terms in `public/data/term-lists-seed.json` (mostly Kinyarwanda, plus a few English crisis phrases) to the admin term lists. Each term goes through the same checks as `admin-terms.html`, and each one added gets its own `auditLog` entry. Terms already on a list are skipped, so it's safe to run again. The script only adds terms: removing a term from the seed file doesn't remove it from a database that was already seeded. Remove it on `admin-terms.html` instead, so the removal is logged too.

All three seed scripts write to the emulators only. The "Import starter terms" button on `admin-terms.html` adds the same starter terms from the page itself, as the signed-in admin, so it also works on a deployed project.

## Testing

```bash
npm test
```

This starts the Firestore emulator, runs every test (the unit tests and the Firestore Security Rules tests) and stops the emulator again. Stop `npm run emulators` first if it is running, because both use the same port.

To run only the unit tests, which need no emulator:

```bash
npm run test:unit
```

### Reports (NFR 21)

Two reports in `docs/` record what the tests show. Both are written by a script, so no number in them is typed by hand.

- **[docs/test-report.md](docs/test-report.md):** a full run, with every test file, how many passed, and which requirements (FR, NFR, BR) the tests name. Run `npm run test:report` to bring it up to date. It runs every test the same way as `npm test`, so stop `npm run emulators` first.
- **[docs/screening-report.md](docs/screening-report.md):** precision and recall of message screening on each labelled set, for the built-in lists, with the starter terms, and with the model check, against the SRS goal of catching 90% of crisis and contact-sharing messages. It also lists by language, and every message the held-out set still gets wrong. Run `npm run report:screening` after changing the screening code, the terms or the sets; a unit test fails until you do. It needs no emulator and no network: the model check's answers to the test messages were saved once in `test/data/model-check-answers.json`.

- **[docs/performance.md](docs/performance.md):** page load times on a slow phone connection (NFR 1), message delivery (NFR 2), 30 people at once and the free plan's limits (NFR 3), and how no message is lost (NFR 18).
- **[docs/accessibility.md](docs/accessibility.md):** how every page was checked against WCAG 2.1 AA, 44 px tap targets and keyboard use (NFR 16), what was found and fixed, and what still needs testing with real screen readers and people.

A Security Rules test also checks NFR 4: a moderator watching the open flags live sees a new crisis flag within 1 minute. It prints the time it took.

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
4. Project settings > General > Your apps: copy the web app's config values into `config/firebase-config.<target>.js` on your computer, where `<target>` is `dev` or `pilot`. Start from `public/js/firebase-config.example.js`. The `config/` folder is gitignored: these files are uploaded with the site but never committed. Keep `modelCheckEnabled = false` in the pilot one.

**Deploy (NFR 22)**

```bash
npx firebase login
npm run deploy:dev      # the development project, from any clean branch
npm run deploy:pilot    # the pilot project, from a clean main only
```

`scripts/deploy.js` does the whole deploy, and stops at the first problem:

1. It refuses if the config file is for a different project than the target, still has `REPLACE_ME` values, or has the model check on for the pilot. It also refuses if anything is uncommitted, or if the pilot deploy isn't from `main`.
2. It runs `npm test` and `npm run lint`.
3. It uploads the site with that target's config, **then** the Security Rules and indexes. The site goes first because new rules can expect what a new page sends: the rules refuse an account without the consent record that the new sign-up page adds.
4. It puts your own `public/js/firebase-config.js` back as it was. That file stays yours for local work (the emulator template, or a project you are trying out).
5. It runs `npm run smoke:<target>`, which only reads the live site. It checks that every page loads with "Need help now", that the site talks to the right project, that the model check is off on the pilot, that the live files match this folder, and that scripts are served with no-cache.

`npm run smoke:dev` and `npm run smoke:pilot` can be run on their own at any time.

Before the pilot starts, work through [docs/pilot-runbook.md](docs/pilot-runbook.md). [docs/demo-script.md](docs/demo-script.md) is a walk-through for demonstrating Spill on the emulators.

**After the first deploy**

- **Staff accounts.** Sign up on the deployed site with each person's own email and a private password. Then, in the Firebase console, open Firestore > `accounts` > that person's document and change `role` to `moderator` or `admin`. A listener applies on `listener-apply.html`, is checked in person, and is then approved by an admin on `admin-listeners.html` (see "How someone becomes a listener"). Don't run `npm run seed:accounts` here: it refuses, and its password is public.
- **Helplines and clinics.** An admin adds the verified ones on `admin-resources.html`. Until the first one is added, or whenever the list can't load, the landing page shows the three helplines built into the crisis card instead of an empty card.
- **Screening terms.** Sign in as an admin, open `admin-terms.html` and press "Import starter terms". It adds the terms in `public/data/term-lists-seed.json` to the three lists, skips any already there, and records each term added in the audit log under that admin. It needs no key and no script, and it is safe to press again. Until it is done, screening uses the built-in lists and the fixed patterns in `firestore.rules`. (`npm run seed:terms` does the same job for the emulators only.)

**Model check on a deployed development copy (optional, demo only)**

The model check is off on every deploy unless these steps are done. It only works for the development project, `spill-dev-01`: that is the one project named in `MODEL_CHECK_PROJECTS` in `public/js/model-check-settings.js`, and the setting is ignored for any other project, including the pilot one. Read "Model check (demo prototype)" above first: it is for made-up messages only.

By hand in the Firebase console, in the development project:

1. AI Logic: press Get started and choose the Gemini Developer API. This is the free option and needs no billing account.
2. App Check > APIs > Firebase AI Logic: set it to unenforced. App Check is not set up in Spill, so with enforcement on every request is refused. Google allows this only until 21 January 2027 at the latest.
3. Authentication > Settings > Authorised domains: check the Hosting domain is listed (the same check as in the one-time setup).

Then on your computer:

4. In `config/firebase-config.dev.js`, set `var modelCheckEnabled = true;`. Leave the template, `firebase-config.example.js`, as `false`. The pilot one must stay `false`: `npm run deploy:pilot` refuses otherwise.
5. Deploy again: `npm run deploy:dev`.

To check it worked, sign in on the deployed site and open "Talk to a listener": the small "Safety check" notice appears. To turn the model check off again, set `modelCheckEnabled` back to `false` in `config/firebase-config.dev.js` and run `npm run deploy:dev` again. Nothing else changes: screening carries on with the term lists and `firestore.rules`.

`firebase.json` sets `Cache-Control: no-cache` on every `.js` and `.css` file, so a deploy that fixes a safety bug (screening, chat) takes effect immediately for everyone instead of waiting out a browser's cached copy. This only applies on a real deploy: the local Hosting emulator doesn't implement custom headers, so you won't see it in `curl` or dev tools while running `npm run emulators`.

## A note on what Spill is not

Spill offers peer support, not therapy, and it's not an emergency service. The "Need help now" button on every page points to real local helplines and clinics for that. The pilot runs on Firebase's free tier with test data and consenting adult volunteers only; it does not yet collect or store real user data, pending the legal review required under Rwanda's data protection law.
