import { normalizeImageFile } from '../lib/imageUpload';
import { isDjangoApiEnabled } from '../lib/runtimeConfig';
import {
  djangoGetMe,
  djangoMediaUrlToStorageKey,
  djangoPatchDoctorProfile,
  djangoResolveMediaUrl,
  djangoUploadDocument,
  enrichDoctorMediaUrls,
} from './djangoApiService';
import { mapDjangoMeToDoctor } from './djangoUserMapper';
import { queueDoctorOnboardingSubmittedEmail } from './onboardingEmailService';
import { DashboardStats, Doctor, Patient } from '../types';
import type { ProfessionalProfileFormData } from '../types/doctorProfile';
import { resolveDoctorProfilePhotoUrl } from '../lib/doctorAvatar';
import {
  firestoreToFormData,
  djangoMeToFormRecord,
  yearsOfExperienceToNumber,
} from '../lib/doctorProfileMapper';

export const getDoctorProfile = async (doctorId: string): Promise<Doctor | null> => {
    try {
        if (isDjangoApiEnabled()) {
            const me = await djangoGetMe();
            if (!me || String(me.id) !== doctorId) return null;
            return enrichDoctorMediaUrls(mapDjangoMeToDoctor(me));
        }
        // Firestore path removed.
        return null;
    } catch (error) {
        throw error;
    }
};

export const getDoctorProfileFormData = async (
    doctorId: string
): Promise<ProfessionalProfileFormData | null> => {
    if (!isDjangoApiEnabled()) return null;
    const me = await djangoGetMe();
    if (!me || String(me.id) !== doctorId) return null;
    const form = firestoreToFormData(djangoMeToFormRecord(me));
    const doctor = await enrichDoctorMediaUrls(mapDjangoMeToDoctor(me));
    return {
      ...form,
      logoUrl: doctor.logoUrl || form.logoUrl,
      profileImageUrl: doctor.profileImageUrl || form.profileImageUrl,
    };
};

export async function uploadPracticeLogo(doctorId: string, file: File): Promise<string> {
    const prepared = await normalizeImageFile(file, 'practice-logo.jpg');
    if (isDjangoApiEnabled()) {
        const uploaded = await djangoUploadDocument(prepared, 'practice-logo', 'logo.jpg');
        await djangoPatchDoctorProfile({ logo_url: uploaded.storageKey });
        return (await djangoResolveMediaUrl(uploaded.url)) ?? uploaded.url;
    }
    // Firestore + Storage path removed.
    throw new Error('Profile logo upload is not available. Set REACT_APP_ANIXI_API_URL to enable the Django document endpoint.');
}

export async function uploadDoctorProfilePhoto(doctorId: string, file: File): Promise<string> {
    const prepared = await normalizeImageFile(file, 'profile.jpg');
    if (isDjangoApiEnabled()) {
        const uploaded = await djangoUploadDocument(prepared, 'doctor-profile', 'avatar.jpg');
        await djangoPatchDoctorProfile({ profile_image_url: uploaded.storageKey });
        return (await djangoResolveMediaUrl(uploaded.url)) ?? uploaded.url;
    }
    // Firestore + Storage path removed.
    throw new Error('Profile photo upload is not available. Set REACT_APP_ANIXI_API_URL to enable the Django document endpoint.');
}

export const saveDoctorProfileForm = async (
    doctorId: string,
    form: ProfessionalProfileFormData,
    logoUrl?: string,
    options?: { submitForReview?: boolean }
): Promise<void> => {
    if (isDjangoApiEnabled()) {
        const resolvedLogo = djangoMediaUrlToStorageKey((logoUrl ?? form.logoUrl).trim());
        const resolvedPhoto = djangoMediaUrlToStorageKey(
            resolveDoctorProfilePhotoUrl(form.profileImageUrl, resolvedLogo),
        );
        const years = yearsOfExperienceToNumber(form.yearsOfExperience);
        await djangoPatchDoctorProfile({
            display_name: form.fullName,
            phone_number: form.phoneNumber,
            specialty: form.medicalSpecialty,
            medical_specialty: form.medicalSpecialty,
            hpcsa_registration_number: form.hpcsaRegistrationNumber,
            practice_name: form.practiceName,
            practice_type: form.practiceType,
            practice_facility: form.practiceFacility,
            province: form.province,
            city: form.city,
            office_address: form.practiceAddress,
            nationality: form.nationality,
            id_or_passport: form.idOrPassport,
            practice_number_bhf: form.practiceNumber,
            vat_number: form.vatNumber,
            ...(form.title.trim() ? { title: form.title } : {}),
            ...(form.gender.trim() ? { gender: form.gender } : {}),
            ...(years != null ? { years_of_experience: years } : {}),
            ...(resolvedLogo ? { logo_url: resolvedLogo } : {}),
            ...(resolvedPhoto ? { profile_image_url: resolvedPhoto } : {}),
            ...(options?.submitForReview ? { submit_for_review: true } : {}),
        });
        if (options?.submitForReview) {
            const doctorEmail = String(form.emailAddress ?? '').trim();
            if (doctorEmail) {
                await queueDoctorOnboardingSubmittedEmail({
                    to: doctorEmail,
                    displayName: form.fullName,
                });
            }
        }
        return;
    }

    // Firestore path removed.
    throw new Error('Doctor profile save is not available. Set REACT_APP_ANIXI_API_URL to enable the Django profile endpoint.');
};

export const updateDoctorProfile = async (doctorId: string, updates: Partial<Doctor>): Promise<void> => {
    if (!isDjangoApiEnabled()) {
        throw new Error('Doctor profile updates require the Anixi API.');
    }
    const patch: Record<string, unknown> = {};
    if (updates.displayName) patch.display_name = updates.displayName;
    if (updates.phoneNumber) patch.phone_number = updates.phoneNumber;
    if (Object.keys(patch).length === 0) return;
    await djangoPatchDoctorProfile(patch);
    void doctorId;
};

export const diagnosticCheck = async () => {
    return { ok: isDjangoApiEnabled() };
};

export const getDoctorPatients = async (doctorId: string): Promise<Patient[]> => {
    const { getDoctorPatients: listPatients } = await import('./patientManagementService');
    return listPatients(doctorId);
};

export const getDashboardStats = async (doctorId: string): Promise<DashboardStats> => {
    const [{ getDoctorPatients: listPatients }, { getDoctorAppointments }] = await Promise.all([
        import('./patientManagementService'),
        import('./appointmentService'),
    ]);
    const [patients, appointments] = await Promise.all([
        listPatients(doctorId),
        getDoctorAppointments(doctorId),
    ]);
    const now = new Date();
    return {
        totalPatients: patients.length,
        warningPatients: 0,
        stablePatients: patients.filter((patient) => patient.rosterStatus !== 'inactive').length,
        inactivePatients: patients.filter((patient) => patient.rosterStatus === 'inactive').length,
        upcomingAppointments: appointments.filter(
            (appointment) => appointment.date >= now && appointment.status !== 'cancelled',
        ).length,
    };
};
