# Performance and reliability

How Spill was checked against the SRS's performance and reliability requirements, what was found, and what was changed. Last checked: 2026-11-19.

| Requirement | What it asks |
|---|---|
| NFR 1 | A page loads in 3 seconds or less on a typical mobile connection. (Should) |
| NFR 2 | A sent message appears to the other person within 2 seconds. (Must) |
| NFR 3 | At least 30 people at once during the pilot, within the free Spark plan. (Should) |
| NFR 18 | Messages saved before delivery, so none is lost; 95% availability during the pilot. (Should) |

## NFR 1: page loads

**How:** each page was opened in Chrome on the live development site, as a phone (390 px), on Chrome's "Slow 4G" setting (1.6 Mbps down, 150 ms delay) with the processor slowed four times. Each page was opened twice: a first visit with nothing cached, then a repeat visit.

| Page | First visit: page shows | First visit: fully loaded | Repeat visit: fully loaded |
|---|---|---|---|
| Home | 1.6 s | 3.0 s | 0.8 to 2.0 s |
| Sign in | 1.4 to 1.6 s | 2.9 to 3.2 s | 0.8 to 1.0 s |
| Privacy notice | 2.0 to 3.0 s | 2.4 to 3.4 s | 1.2 to 1.3 s |

Pages show well within 3 seconds and finish loading at about 3 seconds on a first visit. Most of a first visit's 275 KB is the Firebase library (209 KB, from Google's servers); Spill's own files are about 65 KB, and 10 KB on a repeat visit.

**The real problem was the helplines.** On the home page, the list of helplines only appeared once the Firebase library had loaded, connected and asked the database: **4.5 to 9.3 seconds** on a first visit. That list is what someone in distress comes for.

**Changes:**

- The three built-in helplines are now written into the home page itself, so they show with the page. The admin's list replaces them when it arrives, and stays as it was if it can't load. On the same slow connection they now show in **0.5 to 0.7 seconds** when served locally. A page test keeps them the same as the crisis card's list. "Need help now" was already instant: its helplines are built in.
- Every page that uses Firebase now opens its connections to Google's servers at the very start (`preconnect`), saving several round trips on a slow phone network.
- The two font files (54 KB together) are now kept by the browser for 30 days, instead of being checked on every visit. Scripts and styles stay on `no-cache`, so a safety fix still reaches everyone at once.

**Live check after the deploy** (same settings, nothing cached, 6 loads):

| | Helplines on screen |
|---|---|
| Before the change | 4.5 to 9.3 s |
| After the change | 2.8 to 4.8 s |

About twice as fast. Most of what is left is the wait for the page's first byte from Firebase Hosting, 2.0 to 2.8 seconds on this slow connection. Spill's code can't shorten that wait. The helplines then show 1.5 to 2.0 seconds later, with the page itself; they no longer wait for the database.

## NFR 2: message delivery

A Security Rules test has a listener watch their chat while the user sends a message. It fails if the message takes 2 seconds or more to arrive. On the emulator it arrives in about 0.2 to 0.6 seconds.

Messages use Firestore's live updates: no polling, no server of Spill's own in between. So Spill adds no wait of its own; the real time is the phone network's time to Google and back.

## NFR 3: 30 people at once

**Correctness under load:** a test runs 15 chats, 30 people, sending 45 messages at the same moment. Every message must arrive, and they all do.

**Speed under load can't be measured here.** On the emulator, those 45 messages take 12 to 18 seconds to arrive. That is the emulator, not Spill: with nobody watching, the same 45 writes take under 1 second, and the time goes into the emulator pushing each change to every open chat in turn from one process. Google says the emulator is not for speed or load testing. Measuring the real service would need 30 test accounts on a real project, which this project does not create (they would need known passwords). The pilot's first days are the real test; the runbook says to watch them.

**The free Spark plan.** An estimate for a busy pilot day: 30 people, each checking in, opening pages about 5 times and having one chat of about 30 messages; 5 listeners; the admin opening the statistics a few times.

| What | Free each day | Estimated use | Share |
|---|---|---|---|
| Firestore writes | 20,000 | about 1,200 (messages, chats, check-ins, flags, statistics) | 6% |
| Firestore reads | 50,000 | about 16,000 | 32% |
| Hosting transfer | 360 MB | about 20 MB (Spill's own files only; the Firebase library comes from Google's servers) | 6% |

Reads are the tightest. They include:
- each message being read by both people in the chat, plus the check the Security Rules make;
- the dashboard reading a person's check-ins;
- the statistics page reading every chat summary.

The statistics page costs more as the pilot goes on, because there are more chat summaries to read, so it is better opened a few times a day than left refreshing. These limits are from Firebase's pricing page in November 2026; check them before the pilot. The runbook already says to watch Firebase console > Usage twice a week.

## NFR 18: no message lost

- **Saved before delivery.** A message only reaches the other person by being saved in Firestore first. There is nothing to lose between the two.
- **A failed send keeps the text.** The message box is only cleared once the message is saved; if saving fails, the text stays and the person sees "Could not send that message. Please try again."
- **Offline.** Checked in a browser: with the sender's connection cut, the message stays in their box; when the connection comes back, it reaches the listener, the box clears, and it is saved exactly once.

**Pages no longer get stuck.** Several loads had no error handling, so a dropped connection left "Loading..." for ever, or live updates stopped without a word. Each now says what could not load and to check the connection:

- the dashboard's check-ins;
- the moderator queue, on its own page and on the staff home;
- the listener's requests and active chats;
- the listener's own record, on the listener dashboard and the application page;
- a chat's messages and status;
- a chat request that is waiting.

**One wrong message fixed.** Offline, Firebase answered the check-ins from an empty local copy, so the dashboard told a user "No check-ins yet". The check-ins and the moderator queue now ask the server only. Offline, they say they could not load, and an empty queue always means nothing is waiting.

**Availability (95%).** Spill runs on Google's Firebase Hosting and Firestore, so their uptime is Spill's uptime. `npm run smoke:dev` and `npm run smoke:pilot` check the live site at any time. They only read the site: every page loads with "Need help now", it talks to the right project, and it runs the current code. They now try 3 times before calling a page down, so one dropped connection is not counted as an outage.

**Scheduled uptime check.** GitHub Actions runs `npm run smoke:dev` every 3 hours (`.github/workflows/uptime.yml`), free because the repo is public. A failed run emails the repo owner. The run history is the availability record:

```
gh run list --workflow uptime.yml --limit 200
```

Availability is the passed runs divided by all runs. A run that fails only on "the live site matches this folder" means main was merged but not yet deployed, not that the site was down. For the pilot, change `smoke:dev` to `smoke:pilot` in the workflow once the pilot is deployed. GitHub pauses scheduled workflows after 60 days with no activity in the repo; it can be switched back on from the Actions tab.

## Not yet measured

- Real phones on real Rwandan mobile networks. Chrome's "Slow 4G" is an estimate of a typical connection, not a measurement of MTN or Airtel.
- The real service under 30 people at once (see NFR 3).
