# Demo script

A walk through Spill for the capstone demo, about 10 minutes. It shows the four version 1.0 objectives from the SRS and the safety features, using the local emulators and the demo accounts, so no real data is ever on screen.

## Set up (10 minutes before)

You need internet: the pages load the Firebase library from Google, even on the emulators.

Terminal 1:

```bash
npm run emulators
```

Terminal 2, once the emulators say they are ready:

```bash
npm run seed           # sample helplines and clinics
npm run seed:terms     # the starter screening terms
npm run seed:accounts  # one account per role; the password is in the README
```

Open `http://localhost:5000` in **three separate browser windows**, so each stays signed in as a different person: a normal window, a private window, and a second browser.

| Window | Sign in as |
|---|---|
| A | A new user you sign up during the demo |
| B | `listener@spill.test` |
| C | `moderator@spill.test`, later `admin@spill.test` |

Sign window B in now and leave it on the listener dashboard. To start again from nothing, stop the emulators (their data is not kept) and run the three seed commands again.

## The walk-through

**1. Help comes first, with no account (NFR 5, BR 8).** Window A, the home page: the helplines and clinics, and "Need help now" at the bottom of every page. Press it: the crisis card opens in one tap.

**2. Sign up in under five minutes (O1).** Press "Get started".
- Choose "Under 16" first: Spill explains kindly and makes no account (FR 1.1).
- Choose "18 to 25", enter a made-up email and a password, answer the first-time question, and open the privacy notice to show it (FR 1.3).
- Tick the box and create the account. Point out the made-up name: it is the only name anyone sees (FR 1.2).

**3. Mood check-in (FR 3).** Save a check-in. The numbers at the top update.

**4. Talk to a listener (NFR 17).** Press "Talk to a listener", choose a topic and a mood, and send. In window B, the request appears straight away, with the topic and the mood. Accept it: window A moves into the chat by itself, and in window B press "Open chat" under "Your active chats". Send a message each way: it arrives at once, with no refresh (real-time Firestore).

**5. Every message is screened (O2).**
- User sends `call me at 0788123456`: the message is **not sent**, and the user is told why. Contact-sharing is refused by the Security Rules themselves, so even a tampered browser can't send it.
- User sends `I want to kill myself`: the message **is** delivered, never blocked, and the crisis card opens for the user. A crisis flag is written together with the message.

**6. Mood before and after (O4).** The user ends the chat and gives a mood after, then optionally rates it.

**7. Every flag reaches a moderator (O3).** Window C, sign in as the moderator. The staff home shows the crisis flag in orange, already waiting.
- Press "Open case": the chat opens only now, and opening it is written to the audit log (BR 3).
- Resolve it with a reason (FR 6.8). Optionally suggest a phrase for a term list.
- Back on the staff home, the action shows under "Your recent actions".

**8. The admin side.** Sign window C out and in as the admin. Show applications waiting, suggested terms (approve the demo one), helplines, and "Your recent actions". Admins can't read chats.

**9. The evidence.** Show `docs/test-report.md` (every test passing, and which requirements they cover) and `docs/screening-report.md`. Say the honest numbers: on the held-out set the term lists catch 2 of 15 crisis messages; the model check prototype brings that to 15 of 15; contact-sharing is 5 of 8.

## If something goes wrong

- **A page shows "Loading..." for ever:** the emulators are not running, or the seed was not run. Check terminal 1.
- **Sign-in fails for a demo account:** run `npm run seed:accounts` again.
- **No internet:** the pages can't load the Firebase library. Use the screenshots instead, or the deployed development site with your own test accounts.
