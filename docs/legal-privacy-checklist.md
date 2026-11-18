# Legal and privacy checklist

Where Spill stands on the legal items in the SRS (NFR 14, section 2.5) under Rwanda's data protection law, **Law No. 058/2021 on the protection of personal data and privacy**, and on the privacy requirements around them.

This is a developer's checklist, not legal advice. Items marked **Decision** need someone with the authority to decide (the project supervisor, the university's ethics process, or a legal adviser), and are written as questions for them.

Last reviewed: 2026-11-17.

## Where Spill is now

Spill is a student prototype. Its development project, `spill-dev-01`, stores its database in Google's `africa-south1` region (Johannesburg, South Africa), and sign-in details with Firebase Authentication, also outside Rwanda. Until the open items below are settled, Spill is used **only with made-up test data and adult volunteers (18 or over) who agree to take part** (SRS sections 2.5 and 2.7). The privacy notice says this.

## The NFR 14 items

| # | What the law and the SRS ask | Status | How, and the evidence |
|---|---|---|---|
| 1 | **Exclude under-16s.** A child under 16 needs a guardian's consent (Art. 9). FR 1.1. | Done | Sign-up offers "Under 16", which shows a kind note pointing to the helplines and makes no account. `firestore.rules` refuses any age band other than 16 to 17 and 18 to 25, and an owner can't change their age band later. Tests: `test/rules/firestore.test.js` ("accounts"), `test/unit/pages.test.js`. |
| 2 | **Show a privacy notice** before the account is made, with the limits of confidentiality and the "not therapy" notice. FR 1.3, SRS 2.6. | Done | `public/privacy.html`: who is responsible and how to reach them, what is kept and why, who can see it, confidentiality and its limits, where data is stored and for how long, the person's rights, and the terms of use. Linked from sign-up, the landing page and the dashboard. Works with no account (BR 8). |
| 3 | **Record consent.** FR 1.3. | Done, for new accounts | Each new account stores `privacyNoticeVersion` and `consentedAt`, and `firestore.rules` refuses an account without them, or with a backdated time. Accounts made before this change (the demo and test accounts) have no record. |
| 4 | **Document a 48-hour breach procedure** (Art. 43). | Done | `docs/breach-procedure.md`: contain, assess, report to the NCSA within 48 hours, tell the people affected, fix, review. `firestore.lockdown.rules` shuts every read and write but the helplines in one deploy; `test/rules/lockdown.test.js` tests it. |
| 5 | **Assess registration with the National Cyber Security Authority** (Art. 29). | **Decision** | Spill handles sensitive data: chats, check-ins and moods are about mental health (Art. 3). A controller processing personal data is expected to register with the NCSA before processing real people's data. **Question:** does the pilot with adult volunteers need registration, or only a public launch? Who registers, given Spill is a student project? |
| 6 | **Assess the need for a data protection officer** for large-scale sensitive data (Art. 40). | **Decision** | A pilot of about 30 people is unlikely to be "large-scale", so a DPO is probably not needed yet. Dianah Teta is named as the responsible person and contact in the privacy notice and the breach procedure. **Question:** confirm this for the pilot, and decide who would act as DPO for a wider launch. |
| 7 | **Store personal data in Rwanda, or abroad only with authorisation** (Arts. 48 and 50). | **Not met** | Firebase has no region in Rwanda; the database is in South Africa. This is why the pilot uses test data and consenting adults only. **Question:** before any real launch, either get authorisation for storage abroad (through NCSA registration), or move to hosting in Rwanda, which would mean leaving Firebase (a large change to the stack). |

## Related privacy requirements

| What | Requirement | Status | How, and the evidence |
|---|---|---|---|
| No real names, phone numbers, location or ID documents | NFR 11 | Done | Sign-up asks for none of them. `firestore.rules` refuses any field on an account beyond the known ones. Listener in-person checks are recorded as ticked, never as documents. Contact details in chat are blocked. |
| Email only for sign-in, never shown | NFR 11 | Done | The email lives only in Firebase Authentication, not in Firestore, so no page or rule can show it to anyone. |
| Sensitive data encrypted at rest, read only by participants and logged cases | NFR 12 | Done | Firestore encrypts at rest by default. `firestore.rules` lets only the two people in a chat read it, plus a moderator through a logged case (BR 3); tested in `test/rules/firestore.test.js`. |
| Delete account and personal data | FR 1.5 | Done | "Delete my account" removes the sign-in, account, check-ins and any listener application. Chats, flags and reports stay for safety cases, linked only to a random ID; the privacy notice says so. |
| Keep chats for a limited time (proposed 90 days) | NFR 13 (Should) | **Not built** | The free Spark plan has no scheduled jobs (Cloud Functions need billing), so nothing deletes old chats automatically. The privacy notice says there is no limit yet. **Option:** a monthly admin step that deletes ended chats older than 90 days with no open case. |
| Minors' consent for mental health support | SRS 2.7 | **Decision** | The app accepts 16 to 17 year olds and matches them only with cleared listeners aged 21 or over (BR 1). The SRS says minors' consent rules must be confirmed with a legal or ethics adviser before any under-18 pilot. **Question:** confirm with an adviser; until then, the pilot invites adults only. |
| The model check sends messages to an outside service | NFR 14 | **Prototype only** | Off by default, on only in the development project, and only for people who agree. The free service's terms need users aged 18 or over and allow human review, so it can't be used for real users. See `docs/SRS_change_notes.md`. The privacy notice explains it. |
| Ethics approval and volunteer consent for the pilot | SRS 2.5 (Ethics) | **Decision** | Outside the app. **Question:** does the university require ethics approval for the class pilot, and what consent form do volunteers sign? |

## Before any launch with real users

1. Decide items 5, 6 and 7 with the supervisor or a legal adviser, and register with the NCSA if required.
2. Confirm the rules for 16 and 17 year olds with an adviser, or keep the pilot to adults.
3. Make sure no personal data is stored abroad without authorisation (item 7).
4. Build the 90-day chat limit, or change the privacy notice to say exactly how long chats are kept.
5. Keep the model check off, or replace it with a provider whose terms fit, with proper consent.
6. Practise the breach procedure once, and make sure the NCSA contact in it is current.
7. Re-check the privacy notice against the app, and change its version (and `PRIVACY_NOTICE_VERSION` in `public/js/auth.js`) if anything has changed.
