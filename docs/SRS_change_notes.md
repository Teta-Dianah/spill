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

## Requirements this touches

FR 6.2, FR 6.4, NFR 4, NFR 14, NFR 21.
