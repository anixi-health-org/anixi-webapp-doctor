import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';
import { Patient, SharingRequest } from '../types';
import { getDoctorReferral, logInvitation } from './referralService';

const IOS_APP_LINK = 'https://apps.apple.com/app/anixi-health';
const ANDROID_APP_LINK = 'https://play.google.com/store/apps/details?id=com.anixi.health';
const TRIGGER_EMAIL_COLLECTION =
  (process.env.REACT_APP_TRIGGER_EMAIL_COLLECTION || '').trim() || 'mail';

async function queueTriggerEmail(payload: {
  to: string;
  subject: string;
  html: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
}): Promise<string> {
  const to = payload.to.trim();
  if (!to) throw new Error('Missing recipient email');
  const mailDoc = await addDoc(collection(db, TRIGGER_EMAIL_COLLECTION), {
    to: [to],
    message: {
      subject: payload.subject,
      html: payload.html,
    },
    meta: payload.meta || {},
    createdAt: serverTimestamp(),
  });
  return mailDoc.id;
}

async function queuePatientAppDownloadInviteEmail(opts: {
  doctorId: string;
  to: string;
  patientDisplayName?: string;
}): Promise<string> {
  const referral = await getDoctorReferral(opts.doctorId);
  const signupLink = referral?.referralLink || `${window.location.origin}/sign-up`;
  const helloName = (opts.patientDisplayName || '').trim();
  const greeting = helloName ? `Hello ${escapeHtml(helloName)},` : 'Hello,';

  const subject = 'Download Anixi Health';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <p>${greeting}</p>
      <p>Your doctor has invited you to join Anixi — a care coordination app.</p>
      <p>Sign up on the web: <a href="${signupLink}">${signupLink}</a></p>
      <p>Or download the app:</p>
      <ul>
        <li><a href="${IOS_APP_LINK}">Download on the App Store</a></li>
        <li><a href="${ANDROID_APP_LINK}">Get it on Google Play</a></li>
      </ul>
      <p>If you have any trouble, reply to this email.</p>
      <p>— The Anixi team</p>
    </div>
  `.trim();

  return await queueTriggerEmail({
    to: opts.to,
    subject,
    html,
    meta: {
      type: 'patient_app_download_invite',
      doctorId: opts.doctorId,
    },
  });
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
export const getDoctorPatients = async (doctorId: string): Promise<Patient[]> => {
  try {
    if (!doctorId || doctorId.trim() === '') {
      return [];
    }
    const patientsRef = collection(db, USERS_COLLECTION, doctorId, 'approved_patients');
    let snapshot;
    try {
      snapshot = await getDocs(patientsRef);
    } catch (permissionError) {
      return [];
    }
    if (snapshot.size === 0) {
      return [];
    }
    const patientIds = snapshot.docs.map((doc) => doc.id);
    const patients: Patient[] = [];
    const patientFetchPromises = patientIds.map(async (patientId) => {
      try {
        const userRef = doc(db, 'Users', patientId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          return null;
        }
        const userData = userSnap.data();
        return {
          id: patientId,
          email: userData.email || '',
          displayName: userData.displayName || 'Patient',
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
        return null;
      }
    });
    const results = await Promise.all(patientFetchPromises);
    results.forEach((patient) => {
      if (patient) {
        patients.push(patient);
      }
    });
    return patients;
  } catch (error) {
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
    if (!doctorId || doctorId.trim() === '') {
      throw new Error('Doctor ID is required to fetch requests');
    }
    const requestsRef = collection(db, 'doctors', doctorId, 'patient_requests');
    const allSnapshot = await getDocs(requestsRef);
    if (allSnapshot.size > 0) {
      allSnapshot.docs.forEach((doc, idx) => {
      });
    }
    const q = query(requestsRef, where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    const requests: PatientRequest[] = [];
    for (const requestDoc of snapshot.docs) {
      const requestData = requestDoc.data();
      const patientId = requestData.patientId;
      try {
        const userRef = doc(db, 'patients', patientId);
        const userSnap = await getDoc(userRef);
        let patientInfo: Patient | undefined;
        if (userSnap.exists()) {
          const userData = userSnap.data();
          patientInfo = {
            id: patientId,
            email: userData.email || '',
            displayName: userData.displayName || 'Patient',
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
      }
    }
    return requests;
  } catch (error) {
    throw error;
  }
};
export const debugListAllPatientRequests = async (
  doctorId: string
): Promise<void> => {
  try {
    if (!doctorId) {
      return;
    }
    const requestsRef = collection(db, 'doctors', doctorId, 'patient_requests');
    const allSnapshot = await getDocs(requestsRef);
    if (allSnapshot.size === 0) {
      return;
    }
    allSnapshot.docs.forEach((doc, idx) => {
    });
  } catch (error) {
  }
};
export const acceptPatientRequest = async (
  doctorId: string,
  requestId: string,
  patientId: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    const approvedRef = doc(
      db,
      'doctors',
      doctorId,
      'approved_patients',
      patientId
    );
    batch.set(approvedRef, {
      acceptedAt: serverTimestamp(),
      status: 'active',
    });
    const requestRef = doc(db, 'doctors', doctorId, 'patient_requests', requestId);
    batch.update(requestRef, {
      status: 'accepted',
      respondedAt: serverTimestamp(),
    });
    const patientDocRef = doc(db, 'patients', patientId);
    batch.update(patientDocRef, {
      assignedDoctorId: doctorId,
      updatedAt: serverTimestamp(),
    });
    const patientRequestRef = doc(db, USERS_COLLECTION, patientId, 'doctor_requests', requestId);
    batch.set(patientRequestRef, {
      doctorId,
      patientId,
      status: 'accepted',
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    throw error;
  }
};
export const rejectPatientRequest = async (
  doctorId: string,
  requestId: string
): Promise<void> => {
  try {
    const requestRef = doc(db, 'doctors', doctorId, 'patient_requests', requestId);
    await writeBatch(db)
      .update(requestRef, {
        status: 'rejected',
        respondedAt: serverTimestamp(),
      })
      .commit();
  } catch (error) {
    throw error;
  }
};
export const sendPatientRequest = async (
  patientId: string,
  doctorId: string
): Promise<string> => {
  try {
    if (!patientId || patientId.trim() === '') {
      throw new Error('Patient ID is required');
    }
    if (!doctorId || doctorId.trim() === '') {
      throw new Error('Doctor ID is required');
    }
    const requestsRef = collection(db, 'doctors', doctorId, 'patient_requests');
    const existingReq = query(
      requestsRef,
      where('patientId', '==', patientId),
      where('status', '==', 'pending')
    );
    const existingSnapshot = await getDocs(existingReq);
    if (existingSnapshot.size > 0) {
      throw new Error('You have already sent a request to this doctor');
    }
    const requestData = {
      patientId,
      doctorId,
      status: 'pending',
      createdAt: serverTimestamp(),
      requestedAt: serverTimestamp(),
    };
    const requestsCollection = collection(db, 'doctors', doctorId, 'patient_requests');
    const docRef = await addDoc(requestsCollection, requestData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};
export const calculateAge = (dateOfBirth: Date | undefined | null): number | null => {
  if (!dateOfBirth) return null;
  try {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return null;
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  } catch (error) {
    return null;
  }
};
export const getPatientStatus = (patient: Patient): 'stable' | 'warning' | 'inactive' => {
  return 'stable';
};

/**
 * Add a patient record manually and approve them for the given doctor.
 * Returns the new patient id.
 */
export const addPatientManually = async (
  doctorId: string,
  payload: {
    displayName: string;
    email?: string;
    phoneNumber?: string;
    dateOfBirth?: Date;
    notes?: string;
  },
  // optional: invite the provided email after creating/linking patient
  inviteOptions?: { sendInvite?: boolean; inviteEmail?: string }
): Promise<{ patientId: string; inviteQueued?: boolean; inviteMailId?: string; inviteError?: string }> => {
  if (!doctorId) throw new Error('Doctor ID is required');
  try {
    const normalizedEmail = payload.email?.trim().toLowerCase() || '';
    const normalizedPhone = payload.phoneNumber?.trim() || '';
    let existingPatientId: string | null = null;
    let existingPatientData: any = null;
    const targetEmail = (inviteOptions?.inviteEmail || payload.email || '').trim().toLowerCase();

    const patientsRef = collection(db, 'patients');

    if (normalizedEmail) {
      const emailQuery = query(patientsRef, where('email', '==', normalizedEmail));
      let emailSnapshot;
      try {
        emailSnapshot = await getDocs(emailQuery);
      } catch (e: any) {
        // If rules block querying the whole patients collection, skip de-dupe and proceed.
        // This avoids loosening security rules just to support "lookup by email".
        if (e?.code === 'permission-denied') {
          emailSnapshot = null as any;
        } else {
          throw new Error(`Failed checking existing patient by email. (${e?.code || 'unknown'})`);
        }
      }
      if (emailSnapshot && !emailSnapshot.empty) {
        existingPatientId = emailSnapshot.docs[0].id;
        existingPatientData = emailSnapshot.docs[0].data();
      }
    }

    if (!existingPatientId && normalizedPhone) {
      const phoneQuery = query(patientsRef, where('phoneNumber', '==', normalizedPhone));
      let phoneSnapshot;
      try {
        phoneSnapshot = await getDocs(phoneQuery);
      } catch (e: any) {
        if (e?.code === 'permission-denied') {
          phoneSnapshot = null as any;
        } else {
          throw new Error(`Failed checking existing patient by phone. (${e?.code || 'unknown'})`);
        }
      }
      if (phoneSnapshot && !phoneSnapshot.empty) {
        existingPatientId = phoneSnapshot.docs[0].id;
        existingPatientData = phoneSnapshot.docs[0].data();
      }
    }

    if (existingPatientId) {
      const approvedRef = doc(db, USERS_COLLECTION, doctorId, 'approved_patients', existingPatientId);
      const approvedSnap = await getDoc(approvedRef);
      if (!approvedSnap.exists()) {
        await setDoc(approvedRef, {
          patientId: existingPatientId,
          acceptedAt: serverTimestamp(),
          status: 'active',
        });
      }

      if (existingPatientData && !existingPatientData.assignedDoctorId) {
        const patientDocRef = doc(db, 'patients', existingPatientId);
        await setDoc(
          patientDocRef,
          {
            assignedDoctorId: doctorId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // If requested, also queue the invite email even when patient already exists
      if (inviteOptions?.sendInvite && targetEmail) {
        try {
          const invitationId = await logInvitation(doctorId, targetEmail, 'email');
          const inviteMailId = await queuePatientAppDownloadInviteEmail({
            doctorId,
            to: targetEmail,
            patientDisplayName: payload.displayName || existingPatientData?.displayName,
          });
          const invitationDocRef = doc(db, 'referrals', doctorId, 'invitations', invitationId);
          await updateDoc(invitationDocRef, {
            status: 'queued',
            queuedAt: serverTimestamp(),
            mailId: inviteMailId,
          });
          return { patientId: existingPatientId, inviteQueued: true, inviteMailId };
        } catch (e) {
          console.warn('Failed to queue invite email for existing patient', e);
          return {
            patientId: existingPatientId,
            inviteQueued: false,
            inviteError: e instanceof Error ? e.message : String(e),
          };
        }
      }

      return { patientId: existingPatientId };
    }

    let newPatientRef;
    try {
      newPatientRef = await addDoc(patientsRef, {
        displayName: payload.displayName,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        dateOfBirth: payload.dateOfBirth ? serverTimestamp() : null,
        notes: payload.notes || '',
        isManual: true,
        assignedDoctorId: doctorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      throw new Error(`Permission denied creating patient record. (${e?.code || 'unknown'})`);
    }

    // add reference under doctor's approved_patients so doctor immediately sees the patient
    const approvedRef = doc(db, USERS_COLLECTION, doctorId, 'approved_patients', newPatientRef.id);
    try {
      await setDoc(approvedRef, {
        patientId: newPatientRef.id,
        acceptedAt: serverTimestamp(),
        status: 'active',
      });
    } catch (e: any) {
      throw new Error(`Permission denied linking patient to doctor. (${e?.code || 'unknown'})`);
    }

    // If invite options provided and an email is available, log an invitation
    try {
      let invitationId: string | undefined;
      if (inviteOptions?.sendInvite && targetEmail) {
        invitationId = await logInvitation(doctorId, targetEmail, 'email');
      }

      // Queue email via Firestore Trigger Email extension (no Cloud Function required)
      if (invitationId && inviteOptions?.sendInvite && targetEmail) {
        const inviteMailId = await queuePatientAppDownloadInviteEmail({
          doctorId,
          to: targetEmail,
          patientDisplayName: payload.displayName,
        });
        const invitationDocRef = doc(db, 'referrals', doctorId, 'invitations', invitationId);
        await updateDoc(invitationDocRef, {
          status: 'queued',
          queuedAt: serverTimestamp(),
          mailId: inviteMailId,
        });
        return { patientId: newPatientRef.id, inviteQueued: true, inviteMailId };
      }
    } catch (e) {
      // do not fail patient creation if invite logging fails; surface via console
      console.warn('Failed to log invitation during addPatientManually', e);
      return {
        patientId: newPatientRef.id,
        inviteQueued: false,
        inviteError: e instanceof Error ? e.message : String(e),
      };
    }

    return { patientId: newPatientRef.id };
  } catch (error) {
    throw error;
  }
};

export type PatientUpdatePayload = Partial<
  Omit<Patient, 'id' | 'role' | 'createdAt' | 'updatedAt'> & { notes?: string }
>;

export const updatePatient = async (
  patientId: string,
  updates: PatientUpdatePayload
): Promise<void> => {
  if (!patientId || patientId.trim() === '') {
    throw new Error('Patient ID is required to update patient');
  }
  if (!updates || Object.keys(updates).length === 0) {
    throw new Error('No update values provided');
  }

  try {
    const patientDocRef = doc(db, 'patients', patientId);
    await setDoc(
      patientDocRef,
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    throw error;
  }
};

export const removePatientFromDoctor = async (
  doctorId: string,
  patientId: string
): Promise<void> => {
  if (!doctorId || doctorId.trim() === '') {
    throw new Error('Doctor ID is required');
  }
  if (!patientId || patientId.trim() === '') {
    throw new Error('Patient ID is required');
  }

  try {
    const batch = writeBatch(db);
    const approvedRef = doc(db, USERS_COLLECTION, doctorId, 'approved_patients', patientId);
    batch.delete(approvedRef);

    const patientDocRef = doc(db, 'patients', patientId);
    const patientSnap = await getDoc(patientDocRef);
    if (patientSnap.exists()) {
      const patientData = patientSnap.data() as any;
      const assignedDoctorId = patientData.assignedDoctorId;
      const isManual = patientData.isManual === true;

      if (assignedDoctorId === doctorId) {
        if (isManual) {
          batch.delete(patientDocRef);
        } else {
          batch.set(
            patientDocRef,
            {
              assignedDoctorId: null,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      }
    }

    await batch.commit();
  } catch (error) {
    throw error;
  }
};

export const getDoctorSharingRequests = async (doctorId: string): Promise<SharingRequest[]> => {
  try {

    if (!doctorId || doctorId.trim() === '') {
      return [];
    }

    const sharingReqsRef = collection(db, USERS_COLLECTION, doctorId, 'incoming_sharing_requests');
    const sharingSnapshot = await getDocs(sharingReqsRef);

    const sharingRequests: SharingRequest[] = [];

    for (const requestDoc of sharingSnapshot.docs) {
      const data = requestDoc.data();

      let patientInfo: Patient | undefined;
      try {
        const patientId = data.patientId;
        const patientDocRef = doc(db, 'patients', patientId);
        const patientSnap = await getDoc(patientDocRef);

        
        if (patientSnap.exists()) {
          const userData = patientSnap.data() as any;
          patientInfo = {
            id: patientId,
            email: userData.email || '',
            displayName: userData.displayName || 'Patient',
            role: 'patient',
            dateOfBirth: userData.dateOfBirth?.toDate?.() || undefined,
            gender: userData.gender || undefined,
            maritalStatus: userData.maritalStatus || undefined,
            language: userData.language || undefined,
            address: userData.address || undefined,
            phoneNumber: userData.phoneNumber || undefined,
            assignedDoctorId: userData.assignedDoctorId,
            emergencyContact: userData.emergencyContact || undefined,
            medicalAid: userData.medicalAid || undefined,
            chronicDiseases: userData.chronicDiseases || [],
            allergies: userData.allergies || [],
            currentTreatments: userData.currentTreatments || [],
            createdAt: userData.createdAt?.toDate?.() || new Date(),
            updatedAt: userData.updatedAt?.toDate?.() || new Date(),
          } as Patient;
        } else {
          patientInfo = undefined;
        }
      } catch (error) {
        patientInfo = undefined;
      }

      sharingRequests.push({
        id: requestDoc.id,
        patientId: data.patientId,
        doctorId: data.doctorId,
        doctorInfo: data.doctorInfo,
        requestedDataTypes: data.requestedDataTypes || ['all'],
        status: data.status || 'pending',
        reason: data.reason,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        respondedAt: data.respondedAt?.toDate?.() || undefined,
        patientInfo,
      } as SharingRequest);
    }

    return sharingRequests;
  } catch (error) {
    throw error;
  }
};

export const getPatientsWithSharingRequests = async (doctorId: string): Promise<Map<string, SharingRequest[]>> => {
  try {
    
    const sharingRequests = await getDoctorSharingRequests(doctorId);
    const patientMap = new Map<string, SharingRequest[]>();

    sharingRequests.forEach((req) => {
      if (!patientMap.has(req.patientId)) {
        patientMap.set(req.patientId, []);
      }
      patientMap.get(req.patientId)!.push(req);
    });

    return patientMap;
  } catch (error) {
    throw error;
  }
};

export const acceptSharingRequest = async (
   patientId: string,
   doctorId: string,
   requestId: string
 ): Promise<void> => {
   try {
 
     if (!patientId || !doctorId || !requestId) {
       throw new Error(`Missing required parameters: patientId=${patientId}, doctorId=${doctorId}, requestId=${requestId}`);
     }
 
     const batch = writeBatch(db);
 
     const sharingReqRef = doc(db, USERS_COLLECTION, doctorId, 'incoming_sharing_requests', requestId);
     batch.update(sharingReqRef, {
       status: 'approved',
       respondedAt: serverTimestamp(),
     });
 
     const approvedPatientRef = doc(db, USERS_COLLECTION, doctorId, 'approved_patients', patientId);
     batch.set(approvedPatientRef, {
       patientId: patientId,
       approvedAt: serverTimestamp(),
       status: 'active',
       dataAccessScope: 'all',
     });
 
     const approvedDoctorRef = doc(db, USERS_COLLECTION, patientId, 'approved_doctors', doctorId);
     batch.set(approvedDoctorRef, {
       acceptedAt: serverTimestamp(),
       status: 'active',
       dataAccessScope: 'all',
     });
 
     const patientSharingRequestRef = doc(db, USERS_COLLECTION, patientId, 'doctor_requests', requestId);
     batch.set(patientSharingRequestRef, {
       patientId,
       doctorId,
       status: 'approved',
       respondedAt: serverTimestamp(),
       dataAccessScope: 'all',
       updatedAt: serverTimestamp(),
     });
 
     await batch.commit();
   } catch (error) {
     throw error;
   }
 };

export const rejectSharingRequest = async (
   patientId: string,
   doctorId: string,
   requestId: string
): Promise<void> => {
   try {

     const sharingReqRef = doc(db, USERS_COLLECTION, doctorId, 'incoming_sharing_requests', requestId);
     await writeBatch(db)
       .delete(sharingReqRef)
       .commit();

   } catch (error) {
     throw error;
   }
 };

export const sendSharingRequest = async (
  patientId: string,
  doctorId: string,
  reason?: string,
  requestedDataTypes?: string[]
): Promise<string> => {
  try {

    if (!patientId || patientId.trim() === '') {
      throw new Error('Patient ID is required');
    }
    if (!doctorId || doctorId.trim() === '') {
      throw new Error('Doctor ID is required');
    }

    const requestsRef = collection(db, USERS_COLLECTION, doctorId, 'incoming_sharing_requests');
    const existingReq = query(
      requestsRef,
      where('patientId', '==', patientId),
      where('status', '==', 'pending')
    );
    const existingSnapshot = await getDocs(existingReq);
    if (existingSnapshot.size > 0) {
      throw new Error('You have already sent a sharing request to this doctor');
    }

    const patientDocRef = doc(db, 'patients', patientId);
    const patientSnap = await getDoc(patientDocRef);
    if (!patientSnap.exists()) {
      throw new Error('Patient not found');
    }
    const patientData = patientSnap.data();

    const requestData = {
      patientId,
      doctorId,
      status: 'pending',
      reason: reason || 'Request to share medical data',
      requestedDataTypes: requestedDataTypes || ['all'],
      createdAt: serverTimestamp(),
      patientInfo: {
        displayName: patientData?.displayName || 'Patient',
        email: patientData?.email || '',
        phoneNumber: patientData?.phoneNumber || '',
      },
    };

    const requestsCollection = collection(db, USERS_COLLECTION, doctorId, 'incoming_sharing_requests');
    const docRef = await addDoc(requestsCollection, requestData);

    return docRef.id;
  } catch (error) {
    throw error;
  }
};

export const createTestSharingRequests = async (doctorId: string): Promise<void> => {
  try {

    const testPatients = [
      {
        id: 'test-patient-1',
        displayName: 'Alice Johnson',
        email: 'alice.johnson@email.com',
        phoneNumber: '+27 11 123 4567',
      },
      {
        id: 'test-patient-2',
        displayName: 'Bob Smith',
        email: 'bob.smith@email.com',
        phoneNumber: '+27 21 987 6543',
      },
    ];

    const batch = writeBatch(db);

    for (let i = 0; i < testPatients.length; i++) {
      const patient = testPatients[i];
      const requestData = {
        patientId: patient.id,
        doctorId,
        status: 'pending',
        reason: `Test sharing request ${i + 1}`,
        requestedDataTypes: ['medical_records', 'appointments'],
        createdAt: serverTimestamp(),
        patientInfo: {
          displayName: patient.displayName,
          email: patient.email,
          phoneNumber: patient.phoneNumber,
        },
      };

      const requestRef = doc(collection(db, USERS_COLLECTION, doctorId, 'incoming_sharing_requests'));
      batch.set(requestRef, requestData);
    }

    await batch.commit();
  } catch (error) {
    throw error;
  }
};

export const listenToDoctorPatients = (
  doctorId: string,
  onPatientsUpdate: (patients: Patient[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!doctorId || doctorId.trim() === '') {
    onError(new Error('Doctor ID is required'));
    return () => {};
  }

  const approvedPatientsRef = collection(db, 'Users', doctorId, 'approved_patients');
  

  const unsubscribe = onSnapshot(
    approvedPatientsRef,
    async (snapshot: QuerySnapshot<DocumentData>) => {
      try {
        
        const approvedPatients = snapshot.docs.map((doc) => ({
          id: doc.data().patientId || doc.id,
          ...doc.data()
        }));
        
        
        if (approvedPatients.length === 0) {
          onPatientsUpdate([]);
          return;
        }

        const patientDetailsPromises = approvedPatients.map(async (approvedPatient) => {
          const patientId = approvedPatient.id;
          try {
            const patientRef = doc(db, 'patients', patientId);
            const patientSnap = await getDoc(patientRef);
            
            if (!patientSnap.exists()) {
              return null;
            }
            
            const patientData = patientSnap.data();

            return {
              id: patientSnap.id,
              email: patientData?.email || '',
              displayName: patientData?.fullName || patientData?.displayName || 'Patient',
              role: 'patient' as const,
              dateOfBirth: patientData?.dateOfBirth?.toDate?.() || null,
              gender: patientData?.gender || null,
              maritalStatus: patientData?.maritalStatus || undefined,
              language: patientData?.language || undefined,
              address: patientData?.address || undefined,
              phoneNumber: patientData?.phoneNumber || undefined,
              assignedDoctorId: doctorId,
              emergencyContact: patientData?.emergencyContact || undefined,
              medicalAid: patientData?.medicalAid || undefined,
              chronicDiseases: patientData?.chronicDiseases || [],
              allergies: patientData?.allergies || [],
              currentTreatments: (patientData?.currentTreatments || []).map((treatment: any) => ({
                name: treatment.name,
                dosage: treatment.dosage,
                frequency: treatment.frequency,
                startDate: treatment.startDate?.toDate?.() || new Date(),
              })),
              createdAt: patientData?.createdAt?.toDate?.() || new Date(),
              updatedAt: patientData?.updatedAt?.toDate?.() || new Date(),
            } as Patient;
          } catch (error) {
            return null;
          }
        });

        const results = await Promise.all(patientDetailsPromises);
        const nullCount = results.filter(p => p === null).length;
        if (nullCount > 0) {
        }
        
        const patients = results.filter((p): p is Patient => p !== null);
        onPatientsUpdate(patients);
      } catch (error) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    },
    (error) => {
      onError(error);
    }
  );

  return unsubscribe;
};

export const listenToDoctorSharingRequests = (
  doctorId: string,
  onRequestsUpdate: (requests: SharingRequest[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!doctorId || doctorId.trim() === '') {
    onError(new Error('Doctor ID is required'));
    return () => {};
  }


  const requestsRef = collection(db, USERS_COLLECTION, doctorId, 'incoming_sharing_requests');
  const q = query(requestsRef, where('status', '==', 'pending'));

  const unsubscribe = onSnapshot(
    q,
    async (snapshot: QuerySnapshot<DocumentData>) => {
      try {

        const requests: SharingRequest[] = [];

        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();

          try {
            const patientId = data.patientId;
            const patientDocRef = doc(db, 'patients', patientId);
            const patientSnap = await getDoc(patientDocRef);

            let patientInfo: Patient | undefined;
            if (patientSnap.exists()) {
              const userData = patientSnap.data() as any;
              patientInfo = {
                id: patientId,
                email: userData.email || '',
                displayName: userData.displayName || 'Patient',
                role: 'patient',
                dateOfBirth: userData.dateOfBirth?.toDate?.() || undefined,
                gender: userData.gender || undefined,
                maritalStatus: userData.maritalStatus || undefined,
                language: userData.language || undefined,
                address: userData.address || undefined,
                phoneNumber: userData.phoneNumber || undefined,
                assignedDoctorId: userData.assignedDoctorId,
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
              id: docSnapshot.id,
              patientId: data.patientId,
              doctorId: data.doctorId,
              doctorInfo: data.doctorInfo,
              requestedDataTypes: data.requestedDataTypes || ['all'],
              status: data.status || 'pending',
              reason: data.reason,
              createdAt: data.createdAt?.toDate?.() || new Date(),
              respondedAt: data.respondedAt?.toDate?.() || undefined,
              patientInfo,
            } as SharingRequest);

          } catch (error) {
          }
        }

        onRequestsUpdate(requests);
      } catch (error) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    },
    (error) => {
      onError(error);
    }
  );

  return unsubscribe;
};

export const listenToDoctorPatientRequests = (
  doctorId: string,
  onRequestsUpdate: (requests: PatientRequest[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!doctorId || doctorId.trim() === '') {
    onError(new Error('Doctor ID is required'));
    return () => {};
  }

  const requestsRef = collection(db, 'doctors', doctorId, 'patient_requests');
  const q = query(requestsRef, where('status', '==', 'pending'));

  const unsubscribe = onSnapshot(
    q,
    async (snapshot: QuerySnapshot<DocumentData>) => {
      try {
        const requests: PatientRequest[] = [];

        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();

          try {
            const patientId = data.patientId;
            const patientDocRef = doc(db, 'Users', patientId);
            const patientSnap = await getDoc(patientDocRef);

            let patientInfo: Patient | undefined;
            if (patientSnap.exists()) {
              const userData = patientSnap.data() as any;
              patientInfo = {
                id: patientId,
                email: userData.email || '',
                displayName: userData.displayName || 'Patient',
                role: 'patient',
                dateOfBirth: userData.dateOfBirth?.toDate?.() || undefined,
                gender: userData.gender || undefined,
                maritalStatus: userData.maritalStatus || undefined,
                language: userData.language || undefined,
                address: userData.address || undefined,
                phoneNumber: userData.phoneNumber || undefined,
                assignedDoctorId: userData.assignedDoctorId,
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
              id: docSnapshot.id,
              patientId,
              doctorId,
              status: 'pending',
              requestedAt: data.requestedAt?.toDate?.() || new Date(),
              respondedAt: data.respondedAt?.toDate?.() || undefined,
              patientInfo,
            });
          } catch (error) {
            // Skip this request if patient info cannot be fetched
          }
        }

        onRequestsUpdate(requests);
      } catch (error) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    },
    (error) => {
      onError(error);
    }
  );

  return unsubscribe;
};
