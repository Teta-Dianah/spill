# Changes since SRS v2.0

`Spill_Proposal_and_SRS.pdf` (v2.0) was written before the model check was added. This note lists the places where the SRS no longer matches the code, and how each one should read. Everything else in the SRS stands.

## What changed

Spill now has a **model check**: a demo prototype that asks an outside AI service (Google Gemini, through Firebase AI Logic) to rate a chat message for crisis and abuse after it has been sent. It can only add a flag for the moderators and show the crisis card. It never blocks a message. It is off by default and on only in the development project. The README section "Model check (demo prototype)" describes it in full.

Rule-based screening is unchanged and is still what version 1.0 relies on: the fixed patterns in `firestore.rules` and the term lists in `screening.js`.

## SRS passages to read differently

| SRS section | SRS v2.0 says | Read it as |
|---|---|---|
| 1.1 Scope, out of scope | Machine-learning moderation is out of scope. | Machine-learning moderation is out of scope **for real users**. A model check exists as a demo prototype, off by default, on only in the development project with made-up messages. |
| 2.5 Constraints, Moderation | Rule-based screening only (no machine learning). | Rule-based screening is the screening version 1.0 relies on. A model check can add flags on top of it as a prototype. It never replaces or weakens the rules, and screening works the same without it. |
| Deployment and interfaces | There are no third-party push, SMS or message-broker services in version 1.0. | Still true for push, SMS and message brokers. The one outside service is the model check's AI service, used only when the prototype is switched on in the development project. |
| Scope table, "Rule-based message screening" | Lists rule-based screening as the screening feature. | Unchanged. The model check is an addition, not a replacement. |

## What the prototype does not meet

These are open, and are the reason it is a prototype:

- **NFR 14 (legal).** Messages rated by the model leave Spill for an outside service. The free terms it runs on require users aged 18 or older, say not to submit sensitive information, and allow review by people. Spill's users are 16 to 25. A provider or terms that allow this, and a proper consent step, are needed before any real user's messages are checked this way.
- **FR 6.2 (crisis flag written with the message).** A crisis message found by the rules or the term lists is still written together with its flag. A crisis message found only by the model gets its flag a few seconds later, in a separate write. That is inside the 1-minute target (NFR 4), but it is not atomic, and the flag is lost if the sender closes the page first.
- **NFR 21 (documented and tested screening rules).** The model's instructions and the level that counts are fixed in `public/js/model-check.js`, and how its answer is used is unit tested. The model itself is an outside service and can change, so its results can't be guaranteed the way the term lists' can.

## FR 7.1: moderator-suggested terms

The SRS gives the administrator the job of managing the keyword lists (FR 7.1). That has not changed: only an admin can change a list. Two things were added around it.

**"Import starter terms".** A button on the admin term page adds the starter terms in one go, as the signed-in admin, with an audit entry for each.

**Suggestions from moderators.** A moderator reviewing a flagged chat can suggest a phrase for the crisis or abuse list. The loop is:

flag -> moderator suggests -> admin approves -> list grows

- A suggestion is stored in a new collection, `termSuggestions`, as `{ phrase, category, note, suggestedBy, status, createdAt }`, plus `reviewedBy`, `reviewedAt` and `auditLogId` once an admin has reviewed it. It holds no message text and no user ID other than the moderator's own, so BR 3 and BR 4 are not affected: an admin approving a suggestion sees a phrase, never a chat.
- Nothing is added to a list automatically. Flags, including flags raised by the model check, only reach a list if a moderator suggests a phrase and an admin approves it.
- Approve and Reject each write an `auditLog` entry in the same batch (FR 6.9), and the Security Rules refuse a review without one.
- Contact terms can't be suggested, because they block a message outright.

Read FR 7.1 as: the administrator manages the keyword lists, and may do so by approving or rejecting phrases suggested by moderators.

**Collections.** The SRS list of collections gains `termLists` (the admin-editable lists) and `termSuggestions`. All the added collections are listed under "Collections added since the SRS" below.

## FR 5.1 and FR 5.2: the listener application

The SRS asks for "an application form for volunteers, including the details needed for offline vetting" (FR 5.1) and for the administrator to approve "after offline checks (identity, references, police clearance)" (FR 5.2). Both still stand. What changed is that the app now records the offline checks and enforces them.

- **The form** asks for the age confirmation, motivation, experience, hours a week, two "what would you do" answers, and agreement to the code of conduct and to the in-person checks. It gives the applicant a reference code to quote when arranging those checks.
- **Every listener must be 21 or older.** The SRS describes a listener as a vetted volunteer aged 21 or older, and BR 2 requires it for listeners matched with 16 to 17 year olds. The app now applies it to all listeners: an account in the 16 to 17 age band cannot apply, and the applicant must confirm their age, which is then checked against their identity document in person.
- **An interview is added** to the three checks the SRS names, so there are four: identity, two references, police clearance and an interview.
- **The app records that each check was done, never the document.** This keeps NFR 11 (no real names or identity documents). An admin ticks each check; approval is refused until all four are ticked, and a rejection needs a reason.
- **Every admin step is audited** (FR 6.9): saving checks, approving and rejecting each write an `auditLog` entry in the same batch, and the Security Rules refuse the step without it.

- **The applicant can withdraw.** While an application is waiting, the applicant can remove it and their answers. Deleting an account (FR 1.5) now also removes the listener record and the application.

Read FR 5.2 as: the administrator records each offline check in the app and can approve only when all are recorded.

## FR 1.5: deleting an account

The SRS says a user can delete "their account and personal data", and that mood entries are deleted with the account. The app now does this: deleting an account removes the person's mood entries, their listener record and their listener application, as well as the account itself.

Chats, messages, flags and reports are not removed when the account is. The SRS keeps data tied to an open safety case until the case closes; the app does not yet tell open cases from closed ones, so it keeps all of these. They are tied to a pseudonymous ID, not to a name. A chat with no flag or report is still removed about 90 days after it started, the next time the other person opens their dashboard (NFR 13).

## FR 1.1, FR 1.3 and NFR 14: sign-up, consent and the privacy notice

The SRS says registration is refused for a declared age under 16 (FR 1.1), that the privacy notice, the limits of confidentiality and the peer-support notice are shown and accepted before the account is made (FR 1.3), and lists the NFR 14 items needed before any public launch. The app now does this as follows.

- **"Under 16" is one of the age choices.** Choosing it shows a short, kind note pointing to the helplines, and no account is made. Before, the form only offered 16 to 17 and 18 to 25, so a younger person had no honest answer to give.
- **The privacy notice and terms are a page of their own**, `privacy.html`, linked from sign-up, the landing page and the dashboard. It works with no account. It names Dianah Teta as responsible for the data, with a contact email. The short notice on the sign-up page stays.
- **Consent is recorded.** Each new account stores `privacyNoticeVersion` (which version of the notice was agreed to) and `consentedAt` (when). The Security Rules refuse an account without them.
- **The Security Rules check the account itself:** the age band must be 16 to 17 or 18 to 25, the account must start as an active user, and it may hold only the known fields, so nothing like a real name or phone number can be stored (NFR 11). After that, the owner can only change their block list. Before, an owner could change their own age band, which could have got round BR 1.
- **A breach procedure** (`docs/breach-procedure.md`) and **lock-down rules** (`firestore.lockdown.rules`) cover the 48-hour breach notification (Art. 43).

`docs/legal-privacy-checklist.md` lists every NFR 14 item with its status. Three need a decision outside the app: registration with the NCSA (Art. 29), whether a data protection officer is needed (Art. 40), and storing data in Rwanda (Arts. 48 and 50). The development database is in Google's `africa-south1` region (South Africa), so the last of these is not met, which is why the pilot uses test data and consenting adults only.

**Fields.** `accounts` gains `privacyNoticeVersion` and `consentedAt`.

## FR 4.6: "Would you use Spill again?"

The SRS pilot goal is that at least 70% would use Spill again, "by post-chat survey". The after-chat step asked only "Was this chat helpful?", which can't measure that. It now asks both, and both stay optional:

- "Was this chat helpful?" (unchanged, `rating`);
- "Would you use Spill again?", answered Yes, No or Not sure, saved on the chat as `useAgain` (`yes`, `no` or `not-sure`).

Only the user in the chat can set `useAgain`, and only to one of those three values; the Security Rules refuse the listener, so the pilot number can't be changed by the other side. The privacy notice lists the new answer, and its version moved to 2026-11-18.

**Fields.** `chats` gains `useAgain`.

## FR 7.3: anonymised statistics

The SRS asks the administrator to see "counts of chats, average mood change and flags, without personal data". The admin can't read chats (BR 4) or flags (they can hold the text of a blocked message), so the statistics are built from two small copies that hold no people or text:

- **`chatStats/{chatId}`**: when the user ends a chat and gives a mood, the topic, the mood before and the mood after, and later the two optional answers ("helpful", "would use again"). No user, listener, message or comment. The Security Rules let only that chat's user write it, only once the chat has ended, and every value must match the chat.
- **`safetyTally/{id}`**: one per flag or report, holding only its kind and time. The Rules check it matches a real flag or report by the same person, and it can't be written twice.

Both are written **after** the flag, report or ended chat is saved, never in the same write, so a statistic can never stop a safety action. If one fails, only a count is missed. Only an admin can read them.

The admin's page, `stats.html`, shows the pilot goals and the counts behind them. A share or average only appears once at least 5 people or chats are in it, so a small pilot can't point to one person. "Would use Spill again" is counted per chat, not per person, because the copies hold no names.

**Collections.** Two are added: `chatStats` and `safetyTally` (see the table below).

## App Check

Firebase App Check is **not set up** in Spill, and the SRS does not mention it. It matters only for the model check: Google requires App Check for the service the model check uses. In the development project, enforcement for that one service has been switched off by hand in the Firebase console so the prototype can run. Google has delayed the requirement until 21 January 2027 at the latest.

App Check must be set up before any real use of the model check, or before that date, whichever comes first. Without it the model check stops working and screening is the Security Rules and the term lists alone, which is what version 1.0 relies on anyway. Nothing else in Spill depends on App Check.

## Collections added since the SRS

The SRS lists accounts, moods, chats, messages, flags, reports, resources and the audit log. The app also uses these:

| Collection | What it holds | Why it was added |
|---|---|---|
| `listeners/{uid}` | A listener's approval, training and availability (FR 5). It holds no application answers. | Kept apart from the account so a user's browser can find an available listener without reading anyone's account. |
| `listenerApplications/{uid}` | What a person answered when applying, their reference code, the four in-person checks an admin has ticked, and a rejection reason if there is one. | The answers are private, and `listeners` is readable by every signed-in user, so they can't live there. Only the applicant and an admin can read this. |
| `termLists/{crisis,abuse,contact}` | The admin-editable screening terms (FR 7.1). | So an admin can add terms without a redeploy. |
| `termSuggestions/{id}` | A phrase a moderator suggests for a term list, and the admin's decision. | See "FR 7.1: moderator-suggested terms" above. |
| `chatFlagged/{chatId}` | A marker that a flag or report has been raised against this chat. | Security Rules can only check a named document, not run a search, so this is how the Rules know a chat has something against it. |
| `chatCases/{chatId}` | A marker that a moderator has opened a case on this chat (BR 3). | It is the only way in to a chat's content for a moderator, it can only be created once `chatFlagged` exists, and opening it is what is written to the audit log (FR 6.9). |
| `pendingChats/{uid}` | A marker naming the one chat request a user has outstanding (FR 4.1). | Created in the same write as the chat, so a user can never have two pending requests at once. |
| `chatStats/{chatId}` | An ended chat's topic, moods before and after, and the two optional answers. No people, messages or comments. | The admin's anonymised statistics (FR 7.3), without reading chats (BR 4). |
| `safetyTally/{id}` | One count per flag or report: its kind and time only. | The admin's flag counts (FR 7.3), without reading flags. |
| `sendTimes/{uid}` | When this person last sent a message, and nothing else. | Saved with every message, so the Rules can refuse a second message within 2 seconds (NFR 10). |

The three markers hold no chat content, only these facts. Two fields were also added for the same reason as the markers: `flags` and `reports` carry an `auditLogId` once a moderator resolves them, and `accounts` carries a `lastAuditLogId` once a moderator suspends or reinstates one. The Rules follow these to confirm every moderator action has its audit entry.

## Requirements this touches

FR 1.1, FR 1.3, FR 4.6, FR 5.1, FR 5.2, FR 6.2, FR 6.4, FR 6.9, FR 7.1, FR 7.3, BR 1, BR 2, NFR 4, NFR 10, NFR 11, NFR 14, NFR 21.
