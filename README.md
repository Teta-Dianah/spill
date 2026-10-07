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

## Setup

You'll need Node.js and a JDK 21 or newer (the Firebase emulators run on Java).

```bash
npm install
```

Copy `public/js/firebase-config.example.js` to `public/js/firebase-config.js` and fill in your Firebase project's values. For local development against the emulators only, the committed `public/js/firebase-config.js` already points at a fake "demo-spill-dev" project, so this step is only needed once you connect to a real Firebase project.

## Running locally

```bash
npm run emulators
```

This starts the Firestore and Auth emulators plus Hosting, serving the app at `http://localhost:5000`. The emulator UI (for inspecting data) is at `http://localhost:4000`.

To add some sample helplines and clinics to try the resources page, run in another terminal while the emulators are running:

```bash
npm run seed
```

## Testing

```bash
npm test
```

This runs the plain Jest unit tests. The Firestore Security Rules tests need the emulator running first:

```bash
npx firebase emulators:exec "npm test"
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

## A note on what Spill is not

Spill offers peer support, not therapy, and it's not an emergency service — the "Need help now" button on every page points to real local helplines and clinics for that. The pilot runs on Firebase's free tier with test data and consenting adult volunteers only; it does not yet collect or store real user data, pending the legal review required under Rwanda's data protection law.
