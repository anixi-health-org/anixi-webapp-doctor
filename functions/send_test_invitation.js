const admin = require('firebase-admin');

// Initialize with default credentials (gcloud / ADC) and project
admin.initializeApp({ projectId: 'anixihealth24' });

const db = admin.firestore();

async function run() {
  const doctorId = 'test-doctor';
  const invitationRef = db.collection('referrals').doc(doctorId).collection('invitations').doc();
  const data = {
    doctorId,
    targetEmail: 'tshikamisa22@gmail.com',
    method: 'email',
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await invitationRef.set(data);
  console.log('Created invitation:', invitationRef.path);
}

run().catch((e) => { console.error(e); process.exit(1); });
