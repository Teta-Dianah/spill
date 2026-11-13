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

## App Check

Firebase App Check is **not set up** in Spill, and the SRS does not mention it. It matters only for the model check: Google requires App Check for the service the model check uses. In the development project, enforcement for that one service has been switched off by hand in the Firebase console so the prototype can run. Google has delayed the requirement until 21 January 2027 at the latest.

App Check must be set up before any real use of the model check, or before that date, whichever comes first. Without it the model check stops working and screening is the Security Rules and the term lists alone, which is what version 1.0 relies on anyway. Nothing else in Spill depends on App Check.

## Collections added since the SRS

The SRS lists accounts, moods, chats, messages, flags, reports, resources and the audit log. The app also uses these:

| Collection | What it holds | Why it was added |
|---|---|---|
| `listeners/{uid}` | A listener's application, approval, training and availability (FR 5). | Kept apart from the account so a user's browser can find an available listener without reading anyone's account. |
| `termLists/{crisis,abuse,contact}` | The admin-editable screening terms (FR 7.1). | So an admin can add terms without a redeploy. |
| `termSuggestions/{id}` | A phrase a moderator suggests for a term list, and the admin's decision. | See "FR 7.1: moderator-suggested terms" above. |
| `chatFlagged/{chatId}` | A marker that a flag or report has been raised against this chat. | Security Rules can only check a named document, not run a search, so this is how the Rules know a chat has something against it. |
| `chatCases/{chatId}` | A marker that a moderator has opened a case on this chat (BR 3). | It is the only way in to a chat's content for a moderator, it can only be created once `chatFlagged` exists, and opening it is what is written to the audit log (FR 6.9). |
| `pendingChats/{uid}` | A marker naming the one chat request a user has outstanding (FR 4.1). | Created in the same write as the chat, so a user can never have two pending requests at once. |

The three markers hold no chat content, only these facts. Two fields were also added for the same reason as the markers: `flags` and `reports` carry an `auditLogId` once a moderator resolves them, and `accounts` carries a `lastAuditLogId` once a moderator suspends or reinstates one. The Rules follow these to confirm every moderator action has its audit entry.

## Requirements this touches

FR 6.2, FR 6.4, FR 6.9, FR 7.1, NFR 4, NFR 14, NFR 21.
