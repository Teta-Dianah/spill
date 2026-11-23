# Spill: Software Requirements Specification

**Version 3.1, 23 November 2026. Dianah Teta.**

This version describes Spill as it was built. Each requirement has a status: **Built** (done and tested), **Partly** (the note says what is missing) or **Not built**. The proposal (problem, research, method) is in version 2.0, `docs/Spill_Proposal_and_SRS.pdf`, and is not repeated here.

## Revision history

| Name | Date | Reason for changes | Version |
|---|---|---|---|
| Dianah Teta | 29 September 2026 | Initial version of the project proposal and SRS for Spill | 1.0 |
| Dianah Teta | 26 October 2026 | Added Appendix B with UML diagrams | 2.0 |
| Dianah Teta | 20 November 2026 | Updated to match the built app: status on every requirement, the real data model, new diagrams | 3.0 |
| Dianah Teta | 23 November 2026 | Last seven items built (FR 1.4, FR 3.1, FR 3.4, NFR 10, NFR 13, BR 7, Help page); class and sequence diagrams added | 3.1 |

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for Spill, version 1.0 (minimum viable product): a free, anonymous peer-listener web app for young people aged 16 to 25 in Rwanda.

Out of scope for version 1.0: group spaces (Tier 2), users under 16, machine-learning moderation for real users, a native mobile app, phone verification, and Kinyarwanda or French screens.

### 1.2 Document conventions

- Requirement IDs use the prefixes FR (functional), NFR (non-functional) and BR (business rule), for example FR 4.2. They are the same as in version 2.0.
- Every requirement has a MoSCoW priority: Must, Should or Could.
- "User" means a young person seeking support. "Listener" means a vetted, trained volunteer.
- Names in `code style` are real files or Firestore collections.

### 1.3 Intended audience and reading suggestions

| Reader | Interest | Suggested sections |
|---|---|---|
| Lecturer and assessors | What was built and how well it meets the requirements | 1, 2, 4, 5 |
| Developers | Behaviour, data and rules | 3, 4, 6, Appendix B |
| Testers | What to check and the evidence | 4, 5 |
| Moderators and safeguarding advisers | Safety, escalation and resources | 2.3, FR 6, 5.2, 5.5 |

### 1.4 Product scope

Spill is a web app with three parts:

1. **Open resources (Tier 0):** verified helplines, clinics and self-help tips, and a "Need help now" button on every page. No account needed.
2. **Pseudonymous area (Tier 1):** mood check-ins with history, and one-to-one chat with a trained listener.
3. **Staff area:** pages for listeners, moderators and the administrator.

Every message is screened, and users can only ever reach listeners, never each other.

| Objective | How the app meets it |
|---|---|
| O1: register and start a chat in under five minutes | Sign-up is one page; a chat request is one button and one form. |
| O2: screen every message | Screened in the browser and again by the Security Rules. |
| O3: a moderator reviews every flag | One queue; every action needs a reason and is logged. |
| O4: mood before and after every chat | Asked in the request form and when ending the chat. |

### 1.5 References

- Spill proposal and SRS version 2.0: `docs/Spill_Proposal_and_SRS.pdf`.
- Republic of Rwanda (2021). Law No. 058/2021 relating to the protection of personal data and privacy.
- Evidence: `docs/test-report.md`, `docs/screening-report.md`, `docs/performance.md`, `docs/accessibility.md`, `docs/legal-privacy-checklist.md`, `docs/breach-procedure.md`, `docs/SRS_change_notes.md`.
- Code: https://github.com/Teta-Dianah/spill. Live app: https://spill-dev-01.web.app.

---

## 2. Overall description

### 2.1 Product perspective

Spill is a new, self-contained product. It does not connect to any other system. There is no application server: the pages run in the browser and talk directly to Firebase Hosting, Authentication and Cloud Firestore. Firestore Security Rules decide who may read or write each record and also screen messages. Figure B.10 shows the parts.

### 2.2 Product functions

- **Access and accounts:** sign up with an age band and a random pseudonym, agree to the privacy notice, sign in and out, delete the account.
- **Open resources:** helplines, clinics, self-help tips, a Help page and the crisis card.
- **Mood check-in:** a 1 to 5 mood with tags and a note, history and a monthly recap.
- **Listener chat:** request a chat, be matched, chat in real time, end and rate the chat.
- **Listener management:** apply, in-person checks, approval, training, availability.
- **Safety and moderation:** screening, crisis card, report, block, moderator queue, audit log.
- **Administration:** listeners, term lists, resources and anonymised statistics.

### 2.3 User classes and characteristics

| User class | Characteristics | Privileges and use | Priority |
|---|---|---|---|
| Visitor (Tier 0) | Anyone, no account, may be in distress | Helplines, clinics, self-help, Help page, crisis card | High |
| User (Tier 1) | Aged 16 to 25 (bands 16 to 17 and 18 to 25) | Mood check-ins, chats, report, block, delete own data | Most important |
| Listener | A user aged 21+, checked, approved and trained | Availability, accept or decline (at most 2 chats), chat | Most important |
| Moderator | Trained staff with safeguarding duties | Flag and report queue, logged cases, actions with a reason | High |
| Administrator | The system owner | Listeners, term lists, resources, statistics; cannot read chats | Medium |

### 2.4 Operating environment

- **Client:** any current browser on a phone or computer, from 320 px wide. Nothing to install.
- **Server side:** Firebase free Spark plan; Firestore in `africa-south1` (South Africa).
- **Projects:** `spill-dev-01` is the live site used for testing and the demo. `spill-pilot` has the same pages with separate data and is deployed but not in use (NFR 22).

### 2.5 Design and implementation constraints

- **Legal:** Law No. 058/2021 treats health data as sensitive (Art. 3) and needs a guardian's consent under 16 (Art. 9), so Spill excludes under-16s. See NFR 14.
- **Resources:** one developer, eight weeks, no budget: Spark plan only, no Cloud Functions.
- **Technology:** plain HTML, CSS and JavaScript with the Firebase SDK 12.19.0; real-time chat through Firestore listeners.
- **Moderation:** rule-based screening. An AI "model check" exists only as a prototype on the development site; it can add a flag but never blocks a message.
- **Security Rules can only allow or deny a write**, so the browser writes flags and the Rules refuse a crisis message without its flag.
- **Privacy:** no real names, phone numbers, location or ID documents.
- **Ethics:** peer support, not therapy. The class pilot invites adults only.

### 2.6 User documentation

- Privacy notice, terms of use and confidentiality statement: `privacy.html`.
- Help and FAQ page in plain language: `help.html`.
- Listener training and quiz: `listener-training.html`; code of conduct on the application form.
- README with setup, testing, deployment and a user guide; pilot runbook in `docs/pilot-runbook.md`.

### 2.7 Assumptions and dependencies

- Users have a smartphone or computer and internet access.
- Volunteers can be checked in person; Spill only records that each check was done.
- Helpline and clinic details are kept current by the administrator.
- The free Spark plan is enough for about 30 people at once.

---

## 3. External interface requirements

### 3.1 User interfaces

Mobile-first, calm colours and plain, non-clinical words ("Rough day", "Money stress"). A fixed "Need help now" button on every page. Errors are short and never blaming; sign-in errors do not reveal whether an email exists.

| Page | Who | Purpose |
|---|---|---|
| `index.html`, `privacy.html`, `help.html` | Anyone | Resources, privacy notice, Help page |
| `signup.html`, `signin.html` | Anyone | Sign up and sign in |
| `dashboard.html` | Signed in | Mood check-in, history, recap, open chat |
| `request-chat.html`, `chat.html` | User, listener | Request a chat; the chat |
| `listener-apply.html`, `listener-training.html`, `listener-dashboard.html` | Applicant, listener | Apply, train, accept requests |
| `staff.html`, `moderator-queue.html`, `moderator-case.html` | Moderator | Queue and cases |
| `admin-listeners.html`, `admin-terms.html`, `admin-resources.html`, `stats.html` | Admin | Listeners, terms, resources, statistics |

### 3.2 Hardware interfaces

None. Spill runs in the browser and uses no camera, microphone or location.

### 3.3 Software interfaces

| Component | Version | Purpose |
|---|---|---|
| Firebase JavaScript SDK (compat) | 12.19.0 | Authentication and Firestore from the pages |
| Firebase Hosting | n/a | Serves the pages |
| Firebase Authentication | n/a | Sign-in, password hashing, ID tokens |
| Cloud Firestore and Security Rules | Rules v2 | Data and every access decision |
| Firebase Local Emulator Suite | 15.32.1 | Local testing |
| Jest, ESLint | 30.5.2, 10.12.0 | Tests and code style |
| GitHub Actions | n/a | Tests on every push, uptime check |

### 3.4 Communications interfaces

All traffic uses HTTPS. Chats, requests and the moderator queue update live through Firestore listeners. There are no push, SMS or other message services; email is only used for the verification link.

---

## 4. Requirement specification

### 4.1 Stakeholder requirements

| Stakeholder | Requirement |
|---|---|
| Young people (users) | A private, quick, free and respectful way to talk; no exposure to strangers; clear help when things are serious. |
| Listeners | Clear rules, training and protection; can end unsafe chats; moderator support. |
| Moderators | A prioritised queue, the context to decide, a record of decisions. |
| Administrator | Control over listeners, lists and resources, with logged, limited access to private content. |
| Lecturer and assessors | Traceable, testable requirements that fit an 8-week project. |
| Health system (indirect) | Correct referral details for helplines and clinics. |

### 4.2 Functional requirements

Priority is at the end of each description.

#### FR 1 Access and accounts

| Req ID | Requirement | Description | Status |
|---|---|---|---|
| FR 1.1 | Register account | Register with email, password and age band (16 to 17 or 18 to 25); refuse under 16. (Must) | Built: "Under 16" shows the helplines and makes no account. |
| FR 1.2 | Assign pseudonym | A random display name used everywhere instead of a real identity. (Must) | Built |
| FR 1.3 | Capture consent | Show the privacy and "not therapy" notices and require agreement before the account is made. (Must) | Built: version and time are saved. |
| FR 1.4 | Sign in and out | Sign in with email and password; end the session on sign-out or after inactivity. (Must) | Built: signed out after 30 minutes away, not during a chat. |
| FR 1.5 | Delete account | Delete the account and personal data; keep data tied to an open safety case. (Should) | Built: chats and flags are kept with a random ID only. |
| FR 1.6 | First-time question | Ask once whether this is the first time seeking support (hypothesis H1). (Should) | Built |
| FR 1.7 | Verify email | Send a verification link. (Could) | Built |

#### FR 2 Open resources (Tier 0)

| Req ID | Requirement | Description | Status |
|---|---|---|---|
| FR 2.1 | Display helplines | Helplines with number and a "last verified" date, without an account. (Must) | Built |
| FR 2.2 | Display clinics | Mental health facilities with contact details. (Must) | Built |
| FR 2.3 | Self-help content | Short guides such as breathing and grounding. (Should) | Built |
| FR 2.4 | Need help now | A fixed button on every page opens the crisis card in one tap. (Must) | Built: on all 18 pages, works offline. |

#### FR 3 Mood check-in

| Req ID | Requirement | Description | Status |
|---|---|---|---|
| FR 3.1 | Record mood | Mood on a 1 to 5 scale with optional tags and a short note. (Must) | Built: eight tags, such as "Rough day". |
| FR 3.2 | Mood before and after chat | Record mood before and after a chat and store both with it. (Must) | Built |
| FR 3.3 | Mood history | The user's own history as a list and a simple chart. (Should) | Built |
| FR 3.4 | Monthly recap | A private monthly summary. (Could) | Built |

#### FR 4 Listener chat

| Req ID | Requirement | Description | Status |
|---|---|---|---|
| FR 4.1 | Request a chat | Choose a topic and request a chat. (Must) | Built: one request at a time. |
| FR 4.2 | Match with a listener | Match with an available approved listener; 16 to 17 year olds only with cleared listeners; show the wait status otherwise. (Must) | Built: retries every 15 s for 10 minutes. |
| FR 4.3 | Exchange messages | Send and receive messages in real time. (Must) | Built |
| FR 4.4 | User-initiated only | Only a user may start a chat. (Must) | Built |
| FR 4.5 | End chat | Either person can end a chat at any time without a reason. (Must) | Built |
| FR 4.6 | Rate chat | Optional helpful or not rating and comment. (Should) | Built: plus "Would you use Spill again?" |
| FR 4.7 | Restrict visibility | Chat content visible only to its two people and, through a case, to moderators. (Must) | Built |

#### FR 5 Listener management

| Req ID | Requirement | Description | Status |
|---|---|---|---|
| FR 5.1 | Apply as listener | An application form with the details for offline vetting. (Must) | Built: gives a reference code. |
| FR 5.2 | Approve listeners | Approve or reject after offline checks, and mark who is cleared for minors. (Must) | Built: four checks (interview added). |
| FR 5.3 | Training and quiz | Training and a quiz before accepting chats. (Should) | Built |
| FR 5.4 | Set availability | Mark oneself available or unavailable. (Must) | Built |
| FR 5.5 | Accept or decline | Accept or decline a request, at most two chats at once. (Should) | Built |
| FR 5.6 | Listener dashboard | The listener's own activity summary. (Could) | Built |

#### FR 6 Safety and moderation

| Req ID | Requirement | Description | Status |
|---|---|---|---|
| FR 6.1 | Screen every message | Normalise each message and check it against patterns and term lists before delivery. (Must) | Built: tested on 151 labelled messages. |
| FR 6.2 | Crisis language | Deliver the message, show the crisis card and save a high-priority flag in the same write. (Must) | Built |
| FR 6.3 | Block contact sharing | Reject phone numbers, emails, links and handles, warn the sender, save a blocked-attempt flag. (Must) | Built |
| FR 6.4 | Abusive language | Flag insults and threats for review. (Should) | Built |
| FR 6.5 | Report | Report a chat or the other person with a reason. (Must) | Built |
| FR 6.6 | Block a person | Block the other person so they are not matched again. (Must) | Built |
| FR 6.7 | Moderator queue | Flags and reports ordered by severity and age. (Must) | Built |
| FR 6.8 | Moderator actions | Dismiss, warn, suspend, reinstate or escalate with a recorded reason. (Must) | Built |
| FR 6.9 | Audit log | Log every staff action and every access to chat content. (Should) | Built |
| FR 6.10 | Peer support notice | Show on chat screens that this is peer support, not therapy. (Must) | Built |

#### FR 7 Administration

| Req ID | Requirement | Description | Status |
|---|---|---|---|
| FR 7.1 | Manage term lists | Edit the crisis, contact and abuse lists without redeploying. (Should) | Built: moderators can suggest terms. |
| FR 7.2 | Manage resources | Add, edit and remove helplines and clinics with a last-verified date. (Must) | Built |
| FR 7.3 | Anonymised statistics | Counts of chats, mood change and flags, without personal data. (Should) | Built: groups under 5 hidden. |
| FR 7.4 | Role-based access | Enforce access by role in the Security Rules; a user reads only their own chats. (Must) | Built |

---

## 5. Other non-functional requirements

Evidence for each is in `docs/`.

### 5.1 Performance requirements

| Type | Req ID | Description | Status |
|---|---|---|---|
| Performance | NFR 1 | A page loads in 3 seconds or less on a typical mobile connection. (Should) | Partly: about 3 s on slow 4G; helplines up to 4.8 s live. |
| Performance | NFR 2 | A message appears to the other person within 2 seconds. (Must) | Met: 0.2 to 0.6 s on the emulator. |
| Scalability | NFR 3 | At least 30 people at once within the free plan. (Should) | Met in a 30-person test. |

### 5.2 Safety requirements

| Type | Req ID | Description | Status |
|---|---|---|---|
| Safety | NFR 4 | Crisis flags reach the moderator queue within 1 minute. (Must) | Met |
| Safety | NFR 5 | The crisis card is one tap from any page. (Must) | Met |

### 5.3 Security requirements

| Type | Req ID | Description | Status |
|---|---|---|---|
| Security | NFR 6 | Passwords handled and hashed by Firebase, at least 8 characters. (Must) | Met |
| Security | NFR 7 | All traffic uses HTTPS. (Must) | Met |
| Security | NFR 8 | Every request for private data carries a valid ID token; Tier 0 is public and read-only. (Must) | Met |
| Security | NFR 9 | No raw query strings; all output escaped. (Must) | Met |
| Security | NFR 10 | Sign-in limited by Firebase; message sending throttled by the Rules. (Must) | Met: one message every 2 seconds. |
| Privacy | NFR 11 | No real names, phone numbers, location or ID documents; email for sign-in only. (Must) | Met |
| Privacy | NFR 12 | Messages encrypted at rest, readable only by participants and through a case. (Should) | Met |
| Privacy | NFR 13 | Chats kept for a limited time (90 days). (Should) | Met: removed when either person next opens their dashboard. |
| Legal | NFR 14 | Before launch: exclude under-16s, privacy notice, 48-hour breach procedure, assess NCSA registration and a DPO, data in Rwanda or authorised. (Must) | Done for the class pilot; see `legal-privacy-checklist.md`. |

### 5.4 Software quality attributes

Safety and privacy come first, then usability, then performance.

| Type | Req ID | Description | Status |
|---|---|---|---|
| Usability | NFR 15 | Plain, non-clinical English. (Must) | Met |
| Usability | NFR 16 | WCAG 2.1 AA contrast, keyboard use, 44 px tap targets. (Should) | Met in automated checks |
| Usability | NFR 17 | A signed-in user reaches a chat request in three steps or fewer. (Must) | Met |
| Reliability | NFR 18 | Messages saved before delivery; 95% availability in the pilot. (Should) | Met |
| Auditability | NFR 19 | Staff actions and content access logged; logs not editable. (Should) | Met |
| Maintainability | NFR 20 | Screening rules documented; ESLint; README for setup and deployment. (Must) | Met |
| Testability | NFR 21 | Tests on every push with the emulator; screening tested on 40+ labelled messages. (Must) | Met: 803 tests, 151 messages. |
| Portability | NFR 22 | Config kept out of the code; separate development and pilot projects. (Should) | Met |

### 5.5 Business rules

| Rule | Description | Status |
|---|---|---|
| BR 1 | 16 to 17 year olds are matched only with listeners who are 21+, approved and cleared for minors. | Enforced |
| BR 2 | A listener must be approved and trained before accepting chats. | Enforced |
| BR 3 | Moderators open chat content only through a case from a flag or report; every access is logged. | Enforced |
| BR 4 | Administrators and developers cannot read chats outside moderation. | Enforced |
| BR 5 | Either person can end a chat or block the other at any time without a reason. | Enforced |
| BR 6 | Chats are confidential except where there is serious risk of harm; users are told at sign-up. | Enforced |
| BR 7 | A suspended account cannot chat until a moderator reinstates it. | Enforced |
| BR 8 | Tier 0 resources are always available without an account. | Enforced |

---

## 6. Data model

Version 2.0 listed eight collections; the built app has eighteen.

| Collection | Holds | Who can read it |
|---|---|---|
| `accounts` | Pseudonym, age band, role, status, consent | Owner, moderators, admins |
| `moods` | Mood check-ins | Owner |
| `listeners` | Approval, availability, training | Signed in |
| `listenerApplications` | Application answers and checks | Applicant, admins |
| `chats` | Chat details and moods | The two people; moderator with a case |
| `pendingChats` | The one request a user has waiting | Owner |
| `messages` | Message text | The two people; moderator with a case |
| `sendTimes` | Time of the last message sent | Owner |
| `flags`, `reports` | Safety flags and reports | Moderators |
| `chatFlagged`, `chatCases` | Markers: a chat was flagged; a case was opened | Moderators |
| `auditLog` | Every staff action; never edited | Moderators, admins |
| `resources` | Helplines and clinics | Everyone |
| `termLists`, `termSuggestions` | Screening terms and suggested terms | Signed in; admins |
| `chatStats`, `safetyTally` | Anonymised copies for statistics | Admins |

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| FR / NFR / BR | Functional requirement, non-functional requirement, business rule. |
| MoSCoW | Must, Should, Could: the priority scale. |
| MVP | Minimum viable product: version 1.0. |
| Tier 0 / 1 / 2 | No account; a pseudonymous account; group spaces (not built). |
| Firestore | Firebase's real-time database. |
| Security Rules | Server-side rules that decide every read and write. |
| ID token | The signed pass Firebase gives after sign-in. |
| Emulator Suite | Local Firebase used for tests. |
| Crisis card | The "Need help now" panel of helplines and clinics. |
| Case | A moderator's logged access to a flagged chat. |
| Spark plan | Firebase's free plan. |

---

## Appendix B: UML diagrams

The editable files are in [`docs/diagrams/`](diagrams/).

### 1. Use case diagrams

![Figure B.1: Use case diagram for the Visitor and the User](diagrams/B1-use-cases-visitor-user.png)

**Figure B.1: Use case diagram for the Visitor and the User**

**Description & Flow:** what a person can do before and after registering.

- **Actors:** the Visitor has no account. The User is a registered young person and generalises the Visitor.
- **Base use cases:** the Visitor views helplines, clinics, self-help, the Help page and the crisis card. The User also registers, signs in and out, records moods, views history and the recap, and deletes the account.

| Relationship | Type | Meaning |
|---|---|---|
| Open the crisis card to View helplines | «include» | The card always shows the helplines. |
| Register to Agree to the privacy notice | «include» | Consent is recorded every time. |
| Register to Answer the first-time question | «include» | Asked once at sign-up. |
| Stop an under-16 sign-up to Register | «extend» | Only if "Under 16" is chosen. |
| Add topic tags to Record mood | «extend» | Tags are optional. |

![Figure B.2: Use case diagram for chat and staff roles](diagrams/B2-use-cases-chat-staff.png)

**Figure B.2: Use case diagram for chat and staff roles**

**Description & Flow:** how users and listeners chat safely, and what staff do. Line colours only help follow each actor.

- **Actors:** User, Listener, Moderator, Administrator.
- **Base use cases:** the User requests a chat, sends messages, ends, reports and blocks. The Listener sets availability and accepts or declines. The Moderator reviews the queue and acts. The Administrator approves listeners and manages terms and resources.

| Relationship | Type | Meaning |
|---|---|---|
| Request a chat to Match with a listener | «include» | Every request goes through matching. |
| Exchange messages to Screen every message | «include» | Every message is screened. |
| Show crisis card to Screen every message | «extend» | Only if crisis wording is found. |
| Block contact-sharing to Screen every message | «extend» | Only if contact details are found. |
| Rate chat to End chat | «extend» | Only if the user chooses to rate. |

### 2. Class diagrams

**Description & Flow:** the main data and behaviour of Spill as classes. Each class lists its attributes (-, private) and operations (+, public). Abstract classes are in italics and static operations are underlined.

![Figure B.3: Class diagram, people and roles](diagrams/B3-class-people-roles.png)

**Figure B.3: Class diagram, people and roles**

- **Classes:** Account (abstract) is extended by User, Moderator and Administrator; Listener extends User. MoodCheckIn, SendTime, ListenerApplication and Checks hold each person's data.
- **Inputs and Outputs:** inputs are sign-up details, mood scores, tags and application answers. Outputs are the stored account, check-ins and application.
- **Relationships:**

| Relationship | Type | Meaning |
|---|---|---|
| Moderator, User, Administrator to Account | Inheritance | Every role is an account and inherits the pseudonym, status and sign-in. |
| Listener to User | Inheritance | A listener is a user who was approved. |
| User records MoodCheckIn (1 to 0..*) | Composition | Check-ins are deleted with the account (FR 1.5). |
| User has SendTime (1 to 0..1) | Composition | The last-message time, deleted with the account (NFR 10). |
| Listener applied with ListenerApplication (1 to 1) | Association | The private answers are kept apart from the listener record. |
| Administrator reviews ListenerApplication (0..* to 0..*) | Association | Any admin can review any application (FR 5.2). |
| ListenerApplication to Checks (1 to 0..1) | Composition | The four in-person checks are part of the application. |
| Account blocks Account (0..* to 0..*) | Association | A user or listener can block another account (FR 6.6). |

![Figure B.4: Class diagram, chats and messages](diagrams/B4-class-chats-messages.png)

**Figure B.4: Class diagram, chats and messages**

- **Classes:** Chat, Message, PendingChat and ChatStats, with Screening (a utility) and ScreenResult. User and Listener are shown by name only; their details are in Figure B.3.
- **Inputs and Outputs:** inputs are the topic, moods, messages and after-chat answers. Outputs are the chat, its messages, the screening result and the anonymised copy.
- **Relationships:**

| Relationship | Type | Meaning |
|---|---|---|
| User starts Chat (1 to 0..*) | Association | Only users start chats (FR 4.1, 4.4). |
| Listener listens in Chat (1 to 0..*) | Association | At most 2 active chats per listener (FR 5.5). |
| User holds PendingChat (1 to 0..1) | Association | One request at a time (FR 4.1). |
| PendingChat names Chat (0..1 to 1) | Association | The claim points at the one waiting chat. |
| Chat to Message (1 to 0..*) | Composition | Messages exist only inside their chat and are deleted with it (NFR 13). |
| Chat copied to ChatStats (1 to 0..1) | Association | The anonymised copy, kept after the chat is deleted (FR 7.3). |
| Chat «use» Screening | Dependency | Every message is screened before it is sent (FR 6.1). |
| Screening «create» ScreenResult | Dependency | The yes or no answers that decide what happens next. |

![Figure B.5: Class diagram, safety and administration](diagrams/B5-class-safety-admin.png)

**Figure B.5: Class diagram, safety and administration**

- **Classes:** QueueItem (abstract) with Flag and Report; ChatCase, ChatFlagged, AuditLogEntry, SafetyTally, TermSuggestion, TermList and Resource. Moderator, Administrator and Chat are shown by name only.
- **Inputs and Outputs:** inputs are flags, reports, moderator actions with reasons, suggested terms and resources. Outputs are resolved queue items, cases, audit entries, term lists and statistics counts.
- **Relationships:**

| Relationship | Type | Meaning |
|---|---|---|
| Flag, Report to QueueItem | Inheritance | Both appear in one moderator queue with a severity and status. |
| Moderator resolves QueueItem (0..1 to 0..*) | Association | With an action and a reason (FR 6.8). |
| QueueItem about Chat (0..* to 1) | Association | Each flag or report concerns one chat. |
| QueueItem resolved with AuditLogEntry (0..1 to 0..1) | Association | The action and its log entry are saved together (FR 6.9). |
| QueueItem counted as SafetyTally (1 to 0..1) | Association | A count with no content, for statistics (FR 7.3). |
| ChatFlagged marks Chat (0..1 to 1) | Association | Something was raised about this chat. |
| Moderator opens ChatCase (1 to 0..*) | Association | The only way into a chat's content (BR 3). |
| ChatCase «requires» ChatFlagged | Dependency | A case can only be opened on a flagged chat. |
| ChatCase opened on Chat (0..1 to 1) | Association | One case per chat. |
| ChatCase logged in AuditLogEntry (1 to 1) | Association | Opening a case is always logged. |
| Moderator suggests TermSuggestion (1 to 0..*) | Association | A phrase for a term list. |
| Administrator reviews TermSuggestion (0..1 to 0..*) | Association | Approve or reject, logged. |
| TermSuggestion approved into TermList (0..* to 1) | Association | Nothing reaches a list without an admin. |
| Administrator edits TermList (1 to 0..3) | Association | The crisis, abuse and contact lists (FR 7.1). |
| TermList logged in AuditLogEntry (0..1 to 1..*) | Association | Every change has its own log entry. |
| Administrator manages Resource (1 to 0..*) | Association | Helplines and clinics (FR 7.2). |

### 3. Sequence diagrams

**Description & Flow:** the order of messages between parts in the two main flows. Time runs from top to bottom.

![Figure B.6: Sequence diagram, request a chat and get matched](diagrams/B6-sequence-request-match.png)

**Figure B.6: Sequence diagram, request a chat and get matched**

- The user sends the request. The page searches for a listener every 15 seconds for up to 10 minutes (loop).
- When one is found, the chat is written to Firestore and the listener's dashboard is told.
- The listener accepts or declines (alt). On accept the chat opens; on decline the search continues.

![Figure B.7: Sequence diagram, send a message with screening](diagrams/B7-sequence-send-message.png)

**Figure B.7: Sequence diagram, send a message with screening**

- The page waits for the 2-second gap and screens the message.
- One branch runs (alt): contact details are blocked and flagged; crisis wording is saved with a flag and the crisis card shows; abuse is saved with a flag; anything else is saved.
- The other person's page receives the message live.

### 4. Activity diagrams

![Figure B.8: Activity diagram, register and get matched](diagrams/B8-activity-register-match.png)

**Figure B.8: Activity diagram, register and get matched**

**Description & Flow:** from first visit to an open chat, in three swimlanes: User, System and Listener.

- **Inputs and Outputs:** age band, consent, first-time answer, mood and topic; a new account and an active chat.
- **Flow:** under-16s are stopped. Everyone else agrees, gets a pseudonym, checks in and requests a chat. The system looks for an eligible listener (BR 1) and retries if none is free. When a listener accepts, both chat screens open in parallel.

![Figure B.9: Activity diagram, chat, screening and moderation](diagrams/B9-activity-chat-safety.png)

**Figure B.9: Activity diagram, chat, screening and moderation**

**Description & Flow:** how a chat works and how safety is handled, in three swimlanes: Sender, System and Moderator.

- **Inputs and Outputs:** messages, mood after, reports and moderator actions; delivered messages, flags and audit entries.
- **Flow:** each message is screened and one of four things happens (blocked, crisis, abuse, delivered). This repeats until someone ends the chat. A report goes to the queue; the moderator opens a logged case and acts with a reason.

### 5. Deployment diagram

![Figure B.10: Deployment diagram](diagrams/B10-deployment.png)

**Figure B.10: Deployment diagram of the Spill web application**

**Description & Flow:** where each part of Spill runs and how the parts connect.

- **Nodes:** the user's browser; the development and pilot Firebase projects (Hosting, Authentication, Firestore); the developer's computer with the Emulator Suite; GitHub with Actions.
- **Artifacts:** the 18 pages on Hosting and the Security Rules on Firestore.
- **Connections:**

| Connection | Type | Meaning |
|---|---|---|
| Browser to Hosting | «HTTPS» | Loads the pages. |
| Browser to Authentication | «HTTPS» | Sign-up and sign-in. |
| Browser to Firestore | «HTTPS» | All data, live, checked by the Rules. No application server. |
| Developer's computer to each project | «deploy» | Tests, lint, deploy, then a live check. |
| Developer's computer to GitHub | «HTTPS» | Pushes code; Actions runs the tests. |

---

## Appendix C: What changed from version 2.0

| Area | Version 2.0 | Version 3.1 |
|---|---|---|
| Collections | 8 | 18 |
| Under-16s | Registration refused | "Under 16" choice that makes no account |
| Listener checks | Three | Four (interview added); listeners 21+ |
| After a chat | Helpful or not | Plus "Would you use Spill again?" |
| Term lists | Admin edits | Plus moderator suggestions |
| Screening | Rule-based | Rule-based, plus an AI prototype on the development site |
| 90-day chat removal | Scheduled clean-up | Done when a person opens their dashboard (no scheduled jobs on the free plan) |

Reasons for each change are in `docs/SRS_change_notes.md`.
