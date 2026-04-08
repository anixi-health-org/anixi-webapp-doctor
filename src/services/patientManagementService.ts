import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  addDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';
import { Patient } from '../types';


export const getDoctorPatients = async (doctorId: string): Promise<Patient[]> => {
  try {
    console.log(
      `[getDoctorPatients] ⏳ START - Fetching patients for doctor: ${doctorId}`
    );

    if (!doctorId || doctorId.trim() === '') {
      console.error(`[getDoctorPatients] ❌ ERROR: doctorId is empty or undefined`);
      return [];
    }

    const patientsRef = collection(db, 'doctors', doctorId, 'approved_patients');
    console.log(`[getDoctorPatients] 📋 Querying: doctors/${doctorId}/approved_patients`);

    let snapshot;
    try {
      snapshot = await getDocs(patientsRef);
    } catch (permissionError) {
      console.warn(
        `[getDoctorPatients] ℹ️ Permission denied accessing approved_patients (this is OK):`,
        permissionError
      );
      return [];
    }

    console.log(
      `[getDoctorPatients] ✅ Query result: Found ${snapshot.size} approved patient IDs`
    );

    if (snapshot.size === 0) {
      console.log(`[getDoctorPatients] ℹ️  No patients in approved_patients subcollection`);
      return [];
    }

    const patientIds = snapshot.docs.map((doc) => doc.id);
    console.log(`[getDoctorPatients] 🆔 Patient IDs: ${patientIds.join(', ')}`);

    const patients: Patient[] = [];
    let successCount = 0;
    let failureCount = 0;

    const patientFetchPromises = patientIds.map(async (patientId) => {
      try {
        console.log(`[getDoctorPatients] 👤 Fetching details for patient: ${patientId}`);

        const userRef = doc(db, 'Users', patientId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          console.warn(
            `[getDoctorPatients] ⚠️  Patient ${patientId} not found in Users collection`
          );
          failureCount++;
          return null;
        }

        const userData = userSnap.data();
        console.log(
          `[getDoctorPatients] ✅ Loaded ${patientId}: ${userData.displayName || 'Unknown'}`
        );

        successCount++;

        return {
          id: patientId,
          email: userData.email || '',
          displayName: userData.displayName || 'Unknown Patient',
          role: 'patient' as const,
          dateOfBirth: userData.dateOfBirth?.toDate?.() || undefined,
          gender: userData.gender || undefined,
          maritalStatus: userData.maritalStatus || undefined,
          language: userData.language || undefined,
          address: userData.address || undefined,
          phoneNumber: userData.phoneNumber || undefined,
          assignedDoctorId: userData.assignedDoctorId || doctorId,
          emergencyContact: userData.emergencyContact || undefined,
          medicalAid: userData.medicalAid || undefined,
          chronicDiseases: userData.chronicDiseases || [],
          allergies: userData.allergies || [],
          currentTreatments: userData.currentTreatments || [],
          createdAt: userData.createdAt?.toDate?.() || new Date(),
          updatedAt: userData.updatedAt?.toDate?.() || new Date(),
        } as Patient;
      } catch (error) {
        console.error(
          `[getDoctorPatients] ❌ Error fetching patient ${patientId}:`,
          error
        );
        failureCount++;
        return null;
      }
    });

    const results = await Promise.all(patientFetchPromises);

    results.forEach((patient) => {
      if (patient) {
        patients.push(patient);
      }
    });

    console.log(
      `[getDoctorPatients] 📊 COMPLETE - Loaded ${successCount}/${patientIds.length} patients successfully`
    );

    return patients;
  } catch (error) {
    console.error('[getDoctorPatients] ❌ Unexpected error:', error);
    return [];
  }
};


export interface PatientRequest {
  id: string;
  patientId: string;
  doctorId: string;
  status: 'pending' | 'accepted' | 'rejected';
  requestedAt: Date;
  respondedAt?: Date;
  patientInfo?: Patient; 
}

export const getDoctorPatientRequests = async (
  doctorId: string
): Promise<PatientRequest[]> => {
  try {
    console.log('🔍 ========================================');
    console.log(`🔍 [getDoctorPatientRequests] Starting fetch`);
    console.log(`🔍 doctorId: "${doctorId}"`);
    console.log(`🔍 doctorId type: ${typeof doctorId}`);
    console.log(`🔍 doctorId length: ${doctorId?.length}`);
    console.log('🔍 ========================================');

    if (!doctorId || doctorId.trim() === '') {
      console.error(`[getDoctorPatientRequests] ❌ ERROR: doctorId is invalid`);
      throw new Error('Doctor ID is required to fetch requests');
    }

    console.log(`[getDoctorPatientRequests] 📍 Path: doctors/${doctorId}/patient_requests`);
    const requestsRef = collection(db, 'doctors', doctorId, 'patient_requests');
    
    console.log(`[getDoctorPatientRequests] 🔎 Fetching ALL documents (no filter)...`);
    const allSnapshot = await getDocs(requestsRef);
    console.log(`[getDoctorPatientRequests] 📊 Total docs in collection: ${allSnapshot.size}`);
    
    if (allSnapshot.size > 0) {
      allSnapshot.docs.forEach((doc, idx) => {
        const data = doc.data();
        console.log(`  Document ${idx + 1}:`);
        console.log(`    ID: ${doc.id}`);
        console.log(`    status: "${data.status}" (type: ${typeof data.status})`);
        console.log(`    patientId: ${data.patientId}`);
        console.log(`    requestedAt: ${data.requestedAt}`);
        console.log(`    All fields: ${Object.keys(data).join(', ')}`);
      });
    }

    console.log(`[getDoctorPatientRequests] 🔎 Applying filter: status == 'pending'`);
    const q = query(requestsRef, where('status', '==', 'pending'));
    const snapshot = await getDocs(q);

    console.log(`[getDoctorPatientRequests] ✅ Found ${snapshot.size} pending requests`);

    const requests: PatientRequest[] = [];

    for (const requestDoc of snapshot.docs) {
      const requestData = requestDoc.data();
      const patientId = requestData.patientId;

      try {
        const userRef = doc(db, USERS_COLLECTION, patientId);
        const userSnap = await getDoc(userRef);

        let patientInfo: Patient | undefined;
        if (userSnap.exists()) {
          const userData = userSnap.data();
          patientInfo = {
            id: patientId,
            email: userData.email || '',
            displayName: userData.displayName || 'Unknown Patient',
            role: 'patient',
            dateOfBirth: userData.dateOfBirth?.toDate?.() || undefined,
            gender: userData.gender || undefined,
            maritalStatus: userData.maritalStatus || undefined,
            language: userData.language || undefined,
            address: userData.address || undefined,
            phoneNumber: userData.phoneNumber || undefined,
            assignedDoctorId: userData.assignedDoctorId || doctorId,
            emergencyContact: userData.emergencyContact || undefined,
            medicalAid: userData.medicalAid || undefined,
            chronicDiseases: userData.chronicDiseases || [],
            allergies: userData.allergies || [],
            currentTreatments: userData.currentTreatments || [],
            createdAt: userData.createdAt?.toDate?.() || new Date(),
            updatedAt: userData.updatedAt?.toDate?.() || new Date(),
          } as Patient;
        }

        requests.push({
          id: requestDoc.id,
          patientId,
          doctorId,
          status: 'pending',
          requestedAt: requestData.requestedAt?.toDate?.() || new Date(),
          respondedAt: requestData.respondedAt?.toDate?.() || undefined,
          patientInfo,
        });
      } catch (error) {
        console.error(
          `[getDoctorPatientRequests] Error fetching patient ${patientId}:`,
          error
        );
      }
    }

    console.log(
      `[getDoctorPatientRequests] Successfully loaded ${requests.length} requests`
    );
    return requests;
  } catch (error) {
    console.error('[getDoctorPatientRequests] Error:', error);
    throw error;
  }
};


export const debugListAllPatientRequests = async (
  doctorId: string
): Promise<void> => {
  try {
    console.log('\n🔴 DEBUG: LISTING ALL REQUESTS (ALL STATUSES)');
    console.log('===============================================');

    if (!doctorId) {
      console.error('❌ doctorId is required');
      return;
    }

    const requestsRef = collection(db, 'doctors', doctorId, 'patient_requests');
    const allSnapshot = await getDocs(requestsRef);

    console.log(`✅ Total documents found: ${allSnapshot.size}`);

    if (allSnapshot.size === 0) {
      console.log('⚠️  Collection is EMPTY');
      console.log('===============================================\n');
      return;
    }

    allSnapshot.docs.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`\nDocument #${idx + 1}:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  status: "${data.status || 'MISSING'}"`);
      console.log(`  patientId: ${data.patientId || 'MISSING'}`);
      console.log(`  requestedAt: ${data.requestedAt?.toDate?.() || 'MISSING'}`);
      console.log(`  doctorId: ${data.doctorId || 'MISSING'}`);
      console.log(`  All fields: [${Object.keys(data).join(', ')}]`);
    });

    console.log('\n===============================================\n');
  } catch (error) {
    console.error('😕 Debug function error:', error);
  }
};


export const acceptPatientRequest = async (
  doctorId: string,
  requestId: string,
  patientId: string
): Promise<void> => {
  try {
    console.log(
      `[acceptPatientRequest] Accepting request ${requestId} for patient ${patientId}`
    );

    const batch = writeBatch(db);

    const approvedRef = doc(
      db,
      'doctors',
      doctorId,
      'approved_patients',
      patientId
    );
    batch.set(approvedRef, {
      acceptedAt: new Date(),
      status: 'active',
    });

    const requestRef = doc(db, 'doctors', doctorId, 'patient_requests', requestId);
    batch.update(requestRef, {
      status: 'accepted',
      respondedAt: new Date(),
    });

    const patientRef = doc(db, USERS_COLLECTION, patientId);
    batch.update(patientRef, {
      assignedDoctorId: doctorId,
      updatedAt: new Date(),
    });

    await batch.commit();
    console.log(`[acceptPatientRequest] Request accepted successfully`);
  } catch (error) {
    console.error('[acceptPatientRequest] Error:', error);
    throw error;
  }
};


export const rejectPatientRequest = async (
  doctorId: string,
  requestId: string
): Promise<void> => {
  try {
    console.log(`[rejectPatientRequest] Rejecting request ${requestId}`);

    const requestRef = doc(db, 'doctors', doctorId, 'patient_requests', requestId);
    await writeBatch(db)
      .update(requestRef, {
        status: 'rejected',
        respondedAt: new Date(),
      })
      .commit();

    console.log(`[rejectPatientRequest] Request rejected successfully`);
  } catch (error) {
    console.error('[rejectPatientRequest] Error:', error);
    throw error;
  }
};


export const sendPatientRequest = async (
  patientId: string,
  doctorId: string
): Promise<string> => {
  try {
    console.log('\n🔵 ========================================');
    console.log(`🔵 [sendPatientRequest] CREATING REQUEST`);
    console.log(`🔵 patientId: ${patientId}`);
    console.log(`🔵 doctorId: ${doctorId}`);
    console.log('🔵 ========================================');

    if (!patientId || patientId.trim() === '') {
      throw new Error('Patient ID is required');
    }
    if (!doctorId || doctorId.trim() === '') {
      throw new Error('Doctor ID is required');
    }

    console.log(`[sendPatientRequest] 🔎 Checking if request already exists...`);
    const requestsRef = collection(db, 'doctors', doctorId, 'patient_requests');
    const existingReq = query(
      requestsRef,
      where('patientId', '==', patientId),
      where('status', '==', 'pending')
    );
    const existingSnapshot = await getDocs(existingReq);

    if (existingSnapshot.size > 0) {
      console.log('[sendPatientRequest] ❌ Request already exists for this patient');
      throw new Error('You have already sent a request to this doctor');
    }

    console.log(`[sendPatientRequest] ✍️  Creating new request document...`);
    const requestData = {
      patientId,
      doctorId,
      status: 'pending',
      createdAt: new Date(),
      requestedAt: new Date(),
    };

    console.log(`[sendPatientRequest] 📝 Request data:`, requestData);

    const requestsCollection = collection(db, 'doctors', doctorId, 'patient_requests');
    const docRef = await addDoc(requestsCollection, requestData);

    console.log(`[sendPatientRequest] ✅ SUCCESS! Request created with ID: ${docRef.id}`);
    console.log(`[sendPatientRequest] 📍 Path: doctors/${doctorId}/patient_requests/${docRef.id}`);
    console.log('🔵 ========================================\n');

    return docRef.id;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to send request';
    console.error(`[sendPatientRequest] ❌ ERROR:`, errorMsg);
    throw error;
  }
};


export const calculateAge = (dateOfBirth: Date | undefined): number | undefined => {
  if (!dateOfBirth) return undefined;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

export const getPatientStatus = (patient: Patient): 'stable' | 'warning' | 'inactive' => {
 
  return 'stable';
};
