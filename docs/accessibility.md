# Accessibility and usability

How Spill was checked against the SRS's usability requirements, what was found, and what was fixed. Last checked: 2026-11-18.

| Requirement | What it asks |
|---|---|
| NFR 15 | Plain English that secondary-school graduates understand, and non-clinical wording. |
| NFR 16 | WCAG 2.1 AA colour contrast, keyboard operable, tap targets of at least 44 px. (Should) |
| NFR 17 | A signed-in user reaches a chat request in three steps or fewer. |
| NFR 5 | "Need help now" reachable in one tap from every page. |

## How it was checked

Every page was opened in Chrome against the local emulators, signed in as each role in turn, with real content on screen. The pages checked were:
- the visitor pages;
- the user's dashboard, chat request, chat and listener application;
- the listener's dashboard and training;
- the moderator's staff home, queue and case;
- the admin's staff home, applications, terms, helplines and statistics;
- the sign-up page with "Under 16" chosen;
- the crisis card, open.

On each one, at 320, 390 and 1280 px wide:

1. **axe-core 4.10.2**, the standard automated checker, against WCAG 2.1 A and AA: contrast, labels, names, headings, ARIA, language and more.
2. **Tap targets.** Every button, form control and stand-alone link measured at least 44 × 44 px. A link inside a sentence is exempt, as WCAG allows.
3. **Keyboard.** Tab through the whole page: every stop visible, every stop with a focus ring, no positive `tabindex`, and "Need help now" reachable. With the crisis card open, Tab must stay inside it.

## What was found and fixed

axe-core found **no** WCAG A or AA problems on any page, including colour contrast. The other checks found these, all now fixed:

| Problem | Fix |
|---|---|
| "Need help now" was the last thing on each page, so a keyboard user had to Tab through everything to reach it. On the term lists page it took over 120 presses. | It is now the first thing Tab reaches on every page. It still shows fixed at the bottom of the screen. |
| When the crisis card opened, keyboard focus stayed on the page behind it. | Focus moves to the card's heading, so a screen reader reads "You are not alone." and the helplines come next. |
| Escape did not close the crisis card, and Tab could leave it while it was open. | Escape closes it and Tab goes round inside it. On closing, focus goes back to where it was. |
| Some status lines were not read out by screen readers: sign-in and sign-up errors, "Check-in saved", the listener's availability note, and the chat status. | Each is now a live region (`role="status"`). |
| New messages in a chat were not read out. | A hidden line reads out "New message: …" when the other person writes. The history is not read out on load, and your own messages are not read back to you. |
| The links in "On this page" on the privacy notice, and "Read the full privacy notice and terms" on sign-up, were 16 px tall. | Links on a line of their own are now at least 44 px tall (`.tap-link`). |
| The "Block" button in a chat was 42 px wide. | Link-style buttons are now at least 44 px wide. |
| On a 320 px phone, the five mood buttons on the dashboard were 42 px wide. | The gap between them is smaller on the narrowest screens, so each is at least 44 px. |
| A few words were not plain: a "Submit" button in listener training, and mood messages that read like errors ("Mood score must be a whole number from 1 to 5."). | "Check my answers", "Please choose how today is going, from 1 to 5." and "Your note is a bit long. Please keep it under 280 characters." |

After the fixes, the same checks found no problems at any of the three widths.

## Quick to use (NFR 17)

A signed-in user reaches a chat request in three steps: the dashboard, "Talk to a listener", then one form (topic, mood, send). A page test keeps it that way.

## Kept in place by tests

`test/unit/pages.test.js` checks that:
- every status line is read out;
- "Need help now" comes first;
- the crisis card takes focus, closes with Escape and keeps Tab inside;
- new chat messages are read out;
- link-style buttons are at least 44 px;
- the chat request path stays at three steps.

## Not yet tested

- **Real screen readers.** The checks follow WCAG and use the right roles, but nobody has yet used Spill with TalkBack (Android), VoiceOver (iPhone) or NVDA (Windows). TalkBack matters most, since most pilot users will be on Android phones.
- **Real people.** No usability session has been run with young people in Rwanda. The pilot is the first chance; the runbook asks volunteers for feedback.
- **Zoom and large text.** Pages were checked at 320 px wide, which is close to 200% zoom on a small laptop. A phone's largest text setting has not been tried.

To repeat the automated checks, open a page in Chrome, then use Lighthouse (DevTools > Lighthouse > Accessibility) or the axe DevTools extension. The tap target and keyboard checks were run with scripts outside this repository, so that no new dependency was added to the project.
