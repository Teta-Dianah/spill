// Adds the terms in term-lists-seed.json to the admin-editable screening
// term lists (FR 7.1) in the Firestore emulator. Each term goes through
// the same checks as the admin page (applyTermChange in screening.js),
// so a term the page would refuse is refused here too, and listed.
// Terms already on a list are skipped, so it's safe to run again.
// Every added term gets its own auditLog entry, like an admin change
// (FR 6.9).
//
// Run with: npm run seed:terms
// Needs the emulator running first: npm run emulators

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { applyTermChange } = require('../public/js/screening.js');
const seedTerms = require('./term-lists-seed.json');

initializeApp({ projectId: 'demo-spill-dev' });

const db = getFirestore();
const ACTOR = 'seed-script';

async function seedCategory(category) {
  const listRef = db.collection('termLists').doc(category);
  const listDoc = await listRef.get();
  let terms = listDoc.exists ? listDoc.data().terms || [] : [];

  const batch = db.batch();
  let lastAuditRef = null;
  let added = 0;

  for (const term of seedTerms[category] || []) {
    const result = applyTermChange(category, terms, 'add', null, term);
    if (result.error) {
      console.log(`  ${category}: skipped "${term}" (${result.error})`);
      continue;
    }
    terms = result.terms;
    added++;

    lastAuditRef = db.collection('auditLog').doc();
    batch.set(lastAuditRef, {
      actorId: ACTOR,
      action: 'add_term',
      itemType: 'termList',
      itemId: category,
      oldTerm: null,
      newTerm: terms[terms.length - 1],
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  if (added > 0) {
    batch.set(listRef, {
      terms,
      lastAuditLogId: lastAuditRef.id,
      updatedBy: ACTOR,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }
  console.log(`${category}: added ${added}, list now has ${terms.length}`);
}

async function seed() {
  for (const category of ['crisis', 'abuse', 'contact']) {
    await seedCategory(category);
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
