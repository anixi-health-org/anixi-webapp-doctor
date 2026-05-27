const admin = require('firebase-admin');

const email = process.argv[2] || 'tshikamisa22@gmail.com';

async function main() {
  try {
    admin.initializeApp();
    const db = admin.firestore();

    console.log('Searching for invitations for:', email);
    const q = db.collectionGroup('invitations').where('targetEmail', '==', email);
    const snap = await q.get();
    if (snap.empty) {
      console.log('No invitations found for', email);
      return;
    }

    snap.forEach(doc => {
      console.log('Path:', doc.ref.path);
      console.log('Data:', JSON.stringify(doc.data(), null, 2));
    });
  } catch (err) {
    console.error('Error while querying Firestore:', err.message || err);
    console.error(err);
    process.exit(1);
  }
}

main();
