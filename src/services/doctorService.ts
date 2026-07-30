import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DOCTORS_COLLECTION, USERS_COLLECTION } from '../shared/constants';
import { DashboardStats, Doctor, Patient } from '../types';
import { convertTimestamp } from '../utils/dateFormatter';
import { formDataToFirestore, firestoreToFormData } from '../lib/doctorProfileMapper';
import type { ProfessionalProfileFormData } from '../types/doctorProfile';

function mapDoctorDoc(id: string, doctorData: Record<string, unknown>): Doctor {
    return {
        id,
        email: String(doctorData.email ?? ''),
        displayName:
            (doctorData.displayName as string) ||
            (doctorData.fullName as string) ||
            undefined,
        role: 'doctor',
        specialty:
            (doctorData.specialty as string) ||
            (doctorData.medicalSpecialty as string) ||
            undefined,
        licenseNumber:
            (doctorData.licenseNumber as string) ||
            (doctorData.hpcsaRegistrationNumber as string) ||
            undefined,
        phoneNumber: doctorData.phoneNumber as string | undefined,
        officeAddress:
            (doctorData.officeAddress as string) ||
            (doctorData.practiceAddress as string) ||
            undefined,
        practiceName: doctorData.practiceName as string | undefined,
        logoUrl:
            (doctorData.logoUrl as string) ||
            (doctorData.profileImageUrl as string) ||
            undefined,
        practiceNumberBhf:
            (doctorData.practiceNumberBhf as string) ||
            (doctorData.practiceNumber as string) ||
            undefined,
        vatNumber: doctorData.vatNumber as string | undefined,
        country: doctorData.country as string | undefined,
        currency: doctorData.currency as string | undefined,
        nationality: doctorData.nationality as string | undefined,
        verificationStatus: doctorData.verificationStatus as Doctor['verificationStatus'],
        applicationComplete: Boolean(doctorData.applicationComplete),
        applicationSubmittedAt:
            (doctorData.applicationSubmittedAt as { toDate?: () => Date })?.toDate?.() ||
            undefined,
        verifiedAt:
            (doctorData.verifiedAt as { toDate?: () => Date })?.toDate?.() || undefined,
        rejectionReason:
            (doctorData.rejectionReason as string) ||
            (doctorData.suspensionReason as string) ||
            undefined,
        createdAt:
            (doctorData.createdAt as { toDate?: () => Date })?.toDate?.() || new Date(),
        updatedAt:
            (doctorData.updatedAt as { toDate?: () => Date })?.toDate?.() || new Date(),
    };
}

export const getDoctorProfile = async (doctorId: string): Promise<Doctor | null> => {
    try {
        const doctorDoc = await getDoc(doc(db, DOCTORS_COLLECTION, doctorId));
        if (doctorDoc.exists()) {
            return mapDoctorDoc(doctorDoc.id, doctorDoc.data());
        }
        return null;
    } catch (error) {
        throw error;
    }
};

export const getDoctorProfileFormData = async (
    doctorId: string
): Promise<ProfessionalProfileFormData | null> => {
    const doctorDoc = await getDoc(doc(db, DOCTORS_COLLECTION, doctorId));
    if (!doctorDoc.exists()) {
        return null;
    }
    return firestoreToFormData(doctorDoc.data());
};

export const saveDoctorProfileForm = async (
    doctorId: string,
    form: ProfessionalProfileFormData,
    logoUrl?: string,
    options?: { submitForReview?: boolean }
): Promise<void> => {
    const doctorRef = doc(db, DOCTORS_COLLECTION, doctorId);
    const payload = formDataToFirestore(form, logoUrl);
    const reviewFields = options?.submitForReview
        ? {
              applicationComplete: true,
              applicationSubmittedAt: serverTimestamp(),
              verificationStatus: 'pending',
              verifiedAt: null,
              verifiedBy: null,
          }
        : {};

    await setDoc(
        doctorRef,
        {
            ...payload,
            ...reviewFields,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
};

export const updateDoctorProfile = async (doctorId: string, updates: Partial<Doctor>): Promise<void> => {
    try {
        const doctorRef = doc(db, DOCTORS_COLLECTION, doctorId);
        await setDoc(
            doctorRef,
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
export const diagnosticCheck = async () => {
    try {
        const collectionsToCheck = ['Users', 'patients', 'doctors', 'caregivers'];
        for (const collName of collectionsToCheck) {
            const snapshot = await getDocs(collection(db, collName));
            if (snapshot.size > 0) {
                let count = 0;
                snapshot.forEach((doc) => {
                    if (count < 3) { 
                    }
                    count++;
                });
            }
        }
    } catch (error) {
        ;
    }
};
export const getDoctorPatients = async (doctorId: string): Promise<Patient[]> => {
    try {
        const approvedPatientsRef = collection(db, 'Users', doctorId, 'approved_patients');
        const approvedSnapshot = await getDocs(approvedPatientsRef);
        if (approvedSnapshot.size === 0) {
            return [];
        }
        const patientIds: string[] = [];
        approvedSnapshot.forEach((doc) => {
            const patientId = doc.data().patientId || doc.id;
            patientIds.push(patientId);
        });
        const patients: Patient[] = [];
        const patientFetches = patientIds.map(async (patientId) => {
            try {
                const patientDoc = await getDoc(doc(db, 'patients', patientId));
                if (patientDoc.exists()) {
                    const patientData = patientDoc.data();
                    const userDoc = await getDoc(doc(db, USERS_COLLECTION, patientId));
                    const userData = userDoc.exists() ? userDoc.data() : {};
                    const photoURL =
                        (typeof userData.photoURL === 'string' && userData.photoURL) ||
                        (typeof patientData.photoURL === 'string' && patientData.photoURL) ||
                        (typeof patientData.photoUrl === 'string' && patientData.photoUrl) ||
                        (typeof patientData.profileImageUrl === 'string' && patientData.profileImageUrl) ||
                        undefined;
                    const fullName = patientData.fullName || patientData.displayName || '';
                    const email = patientData.email || '';
                    const createdAtConverted = convertTimestamp(patientData.createdAt);
                    const updatedAtConverted = convertTimestamp(patientData.updatedAt);
                    patients.push({
                        id: patientDoc.id,
                        email: email,
                        displayName: fullName,
                        photoURL,
                        role: 'patient',
                        gender: patientData.gender,
                        phoneNumber: patientData.phoneNumber,
                        address: patientData.address,
                        maritalStatus: patientData.maritalStatus,
                        language: patientData.language,
                        dateOfBirth: convertTimestamp(patientData.dateOfBirth),
                        assignedDoctorId: doctorId,
                        emergencyContact: patientData.emergencyContact,
                        medicalAid: patientData.medicalAid,
                        chronicDiseases: patientData.chronicDiseases,
                        allergies: patientData.allergies,
                        currentTreatments: (patientData.currentTreatments || []).map((treatment: any) => ({
                            name: treatment.name,
                            dosage: treatment.dosage,
                            frequency: treatment.frequency,
                            startDate: convertTimestamp(treatment.startDate),
                        })),
                        createdAt: createdAtConverted,
                        updatedAt: updatedAtConverted,
                    } as Patient);
                } else {
                }
            } catch (error) {
            }
        });
        await Promise.all(patientFetches);
        return patients;
    } catch (error) {
        ;
        return [];
    }
};
export const getDashboardStats = async (doctorId: string): Promise<DashboardStats> => {
    try {
        const patients = await getDoctorPatients(doctorId);
        const totalPatients = patients.length;
        if (totalPatients === 0) {
            return {
                totalPatients: 0,
                warningPatients: 0,
                stablePatients: 0,
                inactivePatients: 0,
                upcomingAppointments: 0,
            };
        }
        let warningCount = 0;
        let stableCount = 0;
        let inactiveCount = 0;
        const now = new Date();
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        patients.forEach((patient) => {
            const lastActive = patient.updatedAt ? new Date(patient.updatedAt) : new Date(patient.createdAt);
            if (lastActive < fiveDaysAgo) {
                inactiveCount++;
            } else {
                stableCount++;
            }
        });
        warningCount = Math.max(0, totalPatients - stableCount - inactiveCount);
        if (warningCount > 0) {
        }
        const stats = {
            totalPatients,
            warningPatients: warningCount,
            stablePatients: stableCount,
            inactivePatients: inactiveCount,
            upcomingAppointments: 0, 
        };
        return stats;
    } catch (error) {
        ;
        return {
            totalPatients: 0,
            warningPatients: 0,
            stablePatients: 0,
            inactivePatients: 0,
            upcomingAppointments: 0,
        };
    }
};
