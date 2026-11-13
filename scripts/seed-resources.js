// Adds a few sample helplines and clinics to the Firestore emulator so
// the resources page isn't empty while developing (FR 2.1, FR 2.2).
// Run with: npm run seed
// Needs the emulator running first: npm run emulators

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ projectId: 'demo-spill-dev' });

const db = getFirestore();

const sampleResources = [
  {
    name: 'Rwanda Biomedical Centre Helpline',
    contact: '114',
    category: 'helpline',
    lastVerified: '2026-09-01',
  },
  {
    name: 'Child Helpline',
    contact: '116',
    category: 'helpline',
    lastVerified: '2026-09-01',
  },
  {
    name: 'Suicide Prevention Helpline',
    contact: '8015',
    category: 'helpline',
    lastVerified: '2026-09-01',
  },
];

async function seed() {
  for (const resource of sampleResources) {
    await db.collection('resources').add(resource);
  }
  console.log('Added ' + sampleResources.length + ' sample resources.');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
