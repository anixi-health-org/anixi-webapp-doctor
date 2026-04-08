import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

async function getCurrentDoctorId(userId: string): Promise<string> {
  try {
    const userDoc = await getDoc(doc(db, 'Users', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log(`[DIAG] User ID: ${userId}`);
      console.log(`[DIAG] User role: ${data.role}`);
      console.log(`[DIAG] User data:`, data);
      
      if (data.role === 'doctor') {
        return userId;
      }
    }
  } catch (error) {
    console.error('[DIAG] Error fetching user:', error);
  }
  return userId;
}


export async function diagnoseDocorsCollection(): Promise<void> {
  console.log('\n🔴 ========================================');
  console.log('🔴 DIAGNOSTIC #1: Checking DOCTORS collection');
  console.log('🔴 ========================================\n');

  try {
    const collections = ['doctors', 'Doctors', 'DOCTORS'];
    
    for (const collName of collections) {
      console.log(`\n[DIAG] Trying collection: "${collName}"`);
      try {
        const snapshot = await getDocs(collection(db, collName));
        console.log(`[DIAG] ✅ Found collection "${collName}" with ${snapshot.size} documents`);
        
        snapshot.forEach((doc) => {
          console.log(`  - Doctor ID: ${doc.id}`);
          const data = doc.data();
          console.log(`    Fields: ${Object.keys(data).join(', ')}`);
        });
      } catch (err) {
        console.log(`[DIAG] ❌ Collection "${collName}" not found or error: ${err}`);
      }
    }
  } catch (error) {
    console.error('[DIAG] Fatal error:', error);
  }
}

export async function diagnosePatientRequestsPath(doctorId: string): Promise<void> {
  console.log('\n🔴 ========================================');
  console.log('🔴 DIAGNOSTIC #2: Checking PATIENT REQUESTS path');
  console.log('🔴 ========================================\n');

  try {
    console.log(`[DIAG] Checking path: doctors/${doctorId}/patient_requests`);
    
    const requestsRef = collection(db, 'doctors', doctorId, 'patient_requests');
    const snapshot = await getDocs(requestsRef);

    console.log(`[DIAG] ✅ Path exists!`);
    console.log(`[DIAG] Total documents: ${snapshot.size}`);

    if (snapshot.size === 0) {
      console.log('[DIAG] ⚠️  Collection is EMPTY - No requests found');
    } else {
      console.log(`\n[DIAG] 📋 All ${snapshot.size} request(s):\n`);
      
      let idx = 1;
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`Request #${idx}:`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  patientId: ${data.patientId}`);
        console.log(`  doctorId: ${data.doctorId}`);
        console.log(`  status: ${data.status}`);
        console.log(`  createdAt: ${data.createdAt}`);
        console.log(`  requestedAt: ${data.requestedAt}`);
        console.log(`  All fields: ${Object.keys(data).join(', ')}`);
        console.log('');
        idx++;
      });
    }
  } catch (error) {
    console.error(`[DIAG] ❌ Error accessing path:`, error);
  }
}


export async function diagnoseAllDoctorSubcollections(doctorId: string): Promise<void> {
  console.log('\n🔴 ========================================');
  console.log('🔴 DIAGNOSTIC #3: Checking ALL subcollections');
  console.log('🔴 ========================================\n');

  try {
    console.log(`[DIAG] Checking all subcollections under: doctors/${doctorId}\n`);

    const subcolls = [
      'patient_requests',
      'patientRequests',
      'requests',
      'approved_patients',
      'approvedPatients',
      'patients',
    ];

    for (const subcoll of subcolls) {
      try {
        console.log(`[DIAG] Checking: doctors/${doctorId}/${subcoll}`);
        const ref = collection(db, 'doctors', doctorId, subcoll);
        const snap = await getDocs(ref);
        console.log(`[DIAG]   ✅ Found: ${snap.size} documents`);
        
        let subIdx = 1;
        snap.forEach((doc) => {
          console.log(`[DIAG]     - ${doc.id}`);
        });
      } catch (err) {
        console.log(`[DIAG]   ❌ Not found or error`);
      }
    }
  } catch (error) {
    console.error('[DIAG] Error:', error);
  }
}


export async function diagnosePatients(): Promise<void> {
  console.log('\n🔴 ========================================');
  console.log('🔴 DIAGNOSTIC #4: Checking PATIENTS in Users');
  console.log('🔴 ========================================\n');

  try {
    console.log(`[DIAG] Fetching all users with role="patient"\n`);

    const usersRef = collection(db, 'Users');
    const snapshot = await getDocs(usersRef);

    let patientCount = 0;
    const patients: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.role === 'patient') {
        patientCount++;
        patients.push({
          id: doc.id,
          displayName: data.displayName,
          email: data.email,
          assignedDoctorId: data.assignedDoctorId,
        });
      }
    });

    console.log(`[DIAG] Found ${patientCount} patients:\n`);
    patients.forEach((p, idx) => {
      console.log(`Patient #${idx + 1}:`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Name: ${p.displayName}`);
      console.log(`  Email: ${p.email}`);
      console.log(`  assignedDoctorId: ${p.assignedDoctorId || 'NONE'}`);
      console.log('');
    });
  } catch (error) {
    console.error('[DIAG] Error:', error);
  }
}

export async function diagnoseFullRequestData(doctorId: string, patientId?: string): Promise<void> {
  console.log('\n🔴 ========================================');
  console.log('🔴 DIAGNOSTIC #5: FULL REQUEST DATA INSPECTION');
  console.log('🔴 ========================================\n');

  try {
    const requestsRef = collection(db, 'doctors', doctorId, 'patient_requests');
    const snapshot = await getDocs(requestsRef);

    console.log(`[DIAG] Total requests: ${snapshot.size}\n`);

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      
      if (patientId && data.patientId !== patientId) continue;

      console.log(`Request ID: ${docSnapshot.id}`);
      console.log(`Raw data:`, JSON.stringify(data, null, 2));
      
      try {
        const patientRef = doc(db, 'Users', data.patientId);
        const patientSnap = await getDoc(patientRef);
        
        if (patientSnap.exists()) {
          console.log(`Patient info found:`, patientSnap.data());
        } else {
          console.log(`⚠️  Patient NOT found in Users collection!`);
        }
      } catch (err) {
        console.log(`Error fetching patient:`, err);
      }
      
      console.log('---\n');
    }
  } catch (error) {
    console.error('[DIAG] Error:', error);
  }
}


export async function runFullDiagnostic(doctorId: string): Promise<void> {
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          PATIENT REQUEST SYSTEM - FULL DIAGNOSTIC          ║');
  console.log('║                    Anixi Health Platform                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log(`Starting diagnostic for Doctor ID: ${doctorId}\n`);

  try {
    await diagnoseDocorsCollection();
    await diagnosePatientRequestsPath(doctorId);
    await diagnoseAllDoctorSubcollections(doctorId);
    await diagnosePatients();
    await diagnoseFullRequestData(doctorId);

    console.log('\n\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                  DIAGNOSTIC COMPLETE                      ║');
    console.log('║         Check console above for data structure            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('[DIAG] FATAL ERROR:', error);
  }
}

declare global {
  interface Window {
    __ANIXI_DIAG__?: {
      runFullDiagnostic: (doctorId: string) => Promise<void>;
      diagnoseDocorsCollection: () => Promise<void>;
      diagnosePatientRequestsPath: (doctorId: string) => Promise<void>;
      diagnoseAllDoctorSubcollections: (doctorId: string) => Promise<void>;
      diagnosePatients: () => Promise<void>;
      diagnoseFullRequestData: (doctorId: string, patientId?: string) => Promise<void>;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__ANIXI_DIAG__ = {
    runFullDiagnostic,
    diagnoseDocorsCollection,
    diagnosePatientRequestsPath,
    diagnoseAllDoctorSubcollections,
    diagnosePatients,
    diagnoseFullRequestData,
  };
  
  console.log('✅ Diagnostics available at: window.__ANIXI_DIAG__');
  console.log('Run: window.__ANIXI_DIAG__.runFullDiagnostic("YOUR_DOCTOR_ID")');
}
