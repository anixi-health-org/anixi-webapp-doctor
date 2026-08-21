import { collection, deleteField, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { DOCTORS_COLLECTION, USERS_COLLECTION } from '../shared/constants';
import { queueDoctorOnboardingSubmittedEmail } from './onboardingEmailService';
import { DashboardStats, Doctor, Patient } from '../types';
import { formDataToFirestore, firestoreToFormData } from '../lib/doctorProfileMapper';
import type { ProfessionalProfileFormData } from '../types/doctorProfile';
import {
  derivePatientRosterStatus,
  resolveRosteredPatient,
} from './patientManagementService';
import {
    isPracticeLetterheadUrl,
    resolveDoctorProfilePhotoUrl,
    resolvePracticeLogoUrl,
} from '../lib/doctorAvatar';

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
        logoUrl: resolvePracticeLogoUrl(
            doctorData.logoUrl as string | undefined,
            doctorData.profileImageUrl as string | undefined,
        ),
        profileImageUrl: resolveDoctorProfilePhotoUrl(
            doctorData.profileImageUrl as string | undefined,
            doctorData.logoUrl as string | undefined,
        ),
        practiceNumberBhf:
            (doctorData.practiceNumberBhf as string) ||
            (doctorData.practiceNumber as string) ||
            undefined,
        vatNumber: doctorData.vatNumber as string | undefined,
        country: doctorData.country as string | undefined,
        currency: doctorData.currency as string | undefined,
        nationality: doctorData.nationality as string | undefined,
        verificationStatus: doctorData.verificationStatus as Doctor['verificationStatus'],
        accountKind: doctorData.accountKind as Doctor['accountKind'],
        requiresClinicalVerification:
          doctorData.requiresClinicalVerification === undefined
            ? undefined
            : Boolean(doctorData.requiresClinicalVerification),
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

export async function uploadPracticeLogo(doctorId: string, file: File): Promise<string> {
    const storageRef = ref(storage, `doctor-logos/${doctorId}/logo.jpg`);
    const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/jpeg',
    });
    const logoUrl = await getDownloadURL(snapshot.ref);
    const now = serverTimestamp();
    const doctorRef = doc(db, DOCTORS_COLLECTION, doctorId);
    const existingDoctor = await getDoc(doctorRef);
    const existingPhoto = existingDoctor.data()?.profileImageUrl;
    const doctorUpdates: Record<string, unknown> = { logoUrl, updatedAt: now };

    if (
        typeof existingPhoto === 'string' &&
        existingPhoto.trim() &&
        !resolveDoctorProfilePhotoUrl(existingPhoto, logoUrl)
    ) {
        doctorUpdates.profileImageUrl = deleteField();
    }

    await setDoc(doctorRef, doctorUpdates, { merge: true });

    const userRef = doc(db, USERS_COLLECTION, doctorId);
    const existingUser = await getDoc(userRef);
    const existingBranding =
        (existingUser.data()?.practiceBranding as Record<string, unknown> | undefined) ?? {};
    const existingUserPhoto =
        typeof existingUser.data()?.photoURL === 'string'
            ? String(existingUser.data()?.photoURL)
            : '';

    const userUpdates: Record<string, unknown> = {
        practiceBranding: {
            ...existingBranding,
            logoUrl,
            updatedAt: now,
        },
        updatedAt: now,
    };
    if (existingUserPhoto && isPracticeLetterheadUrl(existingUserPhoto)) {
        userUpdates.photoURL = deleteField();
    }

    await setDoc(userRef, userUpdates, { merge: true });

    return logoUrl;
}

export async function uploadDoctorProfilePhoto(doctorId: string, file: File): Promise<string> {
    // Use the existing doctor-logos prefix — production Storage rules already
    // allow image writes there. Headshots are stored as profile.jpg, not logo.jpg.
    const storageRef = ref(storage, `doctor-logos/${doctorId}/profile.jpg`);
    const snapshot = await uploadBytes(storageRef, file, {
        contentType: 'image/jpeg',
    });
    const profileImageUrl = await getDownloadURL(snapshot.ref);
    const now = serverTimestamp();

    await setDoc(
        doc(db, DOCTORS_COLLECTION, doctorId),
        { profileImageUrl, updatedAt: now },
        { merge: true }
    );

    await setDoc(
        doc(db, USERS_COLLECTION, doctorId),
        { photoURL: profileImageUrl, updatedAt: now },
        { merge: true }
    );

    return profileImageUrl;
}

export const saveDoctorProfileForm = async (
    doctorId: string,
    form: ProfessionalProfileFormData,
    logoUrl?: string,
    options?: { submitForReview?: boolean }
): Promise<void> => {
    const doctorRef = doc(db, DOCTORS_COLLECTION, doctorId);
    const payload = formDataToFirestore(form, logoUrl);
    const resolvedLogo = (logoUrl ?? form.logoUrl).trim();
    const resolvedPhoto = resolveDoctorProfilePhotoUrl(
        form.profileImageUrl,
        resolvedLogo
    );
    if (!resolvedPhoto) {
        payload.profileImageUrl = deleteField();
    }
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

    try {
        const photoURL = resolvedPhoto;
        const userRef = doc(db, USERS_COLLECTION, doctorId);
        const existingUser = await getDoc(userRef);
        const existingBranding =
            (existingUser.data()?.practiceBranding as Record<string, unknown> | undefined) ??
            {};
        const existingUserPhoto =
            typeof existingUser.data()?.photoURL === 'string'
                ? String(existingUser.data()?.photoURL)
                : '';

        const userMirror: Record<string, unknown> = {
            displayName: form.fullName,
            email: form.emailAddress,
            phoneNumber: form.phoneNumber,
            accountType: 'doctor',
            updatedAt: serverTimestamp(),
        };

        if (photoURL) {
            userMirror.photoURL = photoURL;
        } else if (existingUserPhoto && isPracticeLetterheadUrl(existingUserPhoto)) {
            userMirror.photoURL = deleteField();
        }

        if (resolvedLogo) {
            userMirror.practiceBranding = {
                ...existingBranding,
                logoUrl: resolvedLogo,
                updatedAt: serverTimestamp(),
            };
        }

        await setDoc(userRef, userMirror, { merge: true });
    } catch (error) {
        console.warn('[saveDoctorProfileForm] Users account mirror skipped', error);
    }

    if (options?.submitForReview) {
        const userSnap = await getDoc(doc(db, USERS_COLLECTION, doctorId));
        const doctorEmail =
            (userSnap.exists() ? String(userSnap.data()?.email ?? '') : '') ||
            String(form.emailAddress ?? '').trim();
        if (doctorEmail) {
            await queueDoctorOnboardingSubmittedEmail({
                to: doctorEmail,
                displayName: form.fullName,
            });
        }
    }
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
        const patients: Patient[] = [];
        const patientFetches = approvedSnapshot.docs.map(async (rosterDoc) => {
            try {
                patients.push(
                    await resolveRosteredPatient(
                        doctorId,
                        rosterDoc.data().patientId || rosterDoc.id,
                        rosterDoc.data()
                    )
                );
            } catch {
                // Skip patients the doctor cannot read
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
        patients.forEach((patient) => {
            const status = derivePatientRosterStatus(patient);
            if (status === 'inactive') inactiveCount += 1;
            else if (status === 'stable') stableCount += 1;
            else warningCount += 1;
        });
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
