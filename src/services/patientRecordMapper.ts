import { Patient } from '../types';
import { convertTimestamp } from '../utils/dateFormatter';

function formatPhysicalAddress(addr: unknown): string | undefined {
  if (!addr || typeof addr !== 'object') return undefined;
  const a = addr as Record<string, unknown>;
  const parts = [
    a.address || a.street,
    a.city,
    a.state,
    a.postalCode,
    a.country,
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string' && item.trim()) return [item.trim()];
      if (item && typeof item === 'object' && 'value' in item) {
        const raw = (item as { value?: unknown }).value;
        return typeof raw === 'string' && raw.trim() ? [raw.trim()] : [];
      }
      return [];
    });
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Merge Users/{id} + patients/{id} (mobile medical profile) into a Patient view model.
 * Medical essentials (blood group, weight, allergies) live on the patients collection.
 */
export function mapPatientRecord(
  patientId: string,
  patientData: Record<string, unknown> | undefined,
  userData: Record<string, unknown> | undefined,
  doctorId?: string
): Patient {
  const p = patientData ?? {};
  const u = userData ?? {};

  const composedName = [u.firstName, u.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim();

  const displayName =
    (typeof p.fullName === 'string' && p.fullName.trim()) ||
    (typeof p.displayName === 'string' && p.displayName.trim()) ||
    (typeof u.displayName === 'string' && u.displayName.trim()) ||
    (typeof u.fullName === 'string' && u.fullName.trim()) ||
    (typeof u.name === 'string' && u.name.trim()) ||
    composedName ||
    (typeof u.Username === 'string' && u.Username.trim()) ||
    (typeof u.email === 'string' && u.email.includes('@') ? u.email.split('@')[0] : '') ||
    (typeof p.email === 'string' && p.email.includes('@') ? p.email.split('@')[0] : '') ||
    'Patient';

  const photoURL =
    (typeof u.photoURL === 'string' && u.photoURL) ||
    (typeof p.photoURL === 'string' && p.photoURL) ||
    (typeof p.photoUrl === 'string' && p.photoUrl) ||
    (typeof p.profileImageUrl === 'string' && p.profileImageUrl) ||
    undefined;

  const addressFromPatient =
    (typeof p.address === 'string' && p.address.trim()) ||
    formatPhysicalAddress(p.physicalAddress) ||
    undefined;

  const phone =
    (typeof p.phoneNumber === 'string' && p.phoneNumber.trim()) ||
    (typeof p.cellNumber === 'string' && p.cellNumber.trim()) ||
    (typeof u.phoneNumber === 'string' && u.phoneNumber.trim()) ||
    undefined;

  const allergies = asStringArray(p.allergies).length
    ? asStringArray(p.allergies)
    : asStringArray(u.allergies);

  const conditions = asStringArray(p.chronicDiseases).length
    ? asStringArray(p.chronicDiseases)
    : asStringArray(p.previousHealthConditions).length
      ? asStringArray(p.previousHealthConditions)
      : asStringArray(u.chronicDiseases);

  const medicalAidFromScheme =
    typeof p.medicalSchemeName === 'string' && p.medicalSchemeName.trim()
      ? {
          provider: p.medicalSchemeName as string,
          memberNumber:
            (typeof p.memberNumber === 'string' && p.memberNumber) ||
            '',
          groupNumber:
            (typeof p.planOption === 'string' && p.planOption) || undefined,
        }
      : undefined;

  const treatmentsRaw = (p.currentTreatments ?? u.currentTreatments ?? []) as Array<
    Record<string, unknown>
  >;
  const currentTreatments = Array.isArray(treatmentsRaw)
    ? treatmentsRaw.map((treatment) => ({
        name: String(treatment.name ?? ''),
        dosage: String(treatment.dosage ?? ''),
        frequency: String(treatment.frequency ?? ''),
        startDate: convertTimestamp(treatment.startDate) ?? new Date(),
      }))
    : [];

  return {
    id: patientId,
    email: String(p.email || u.email || ''),
    displayName,
    photoURL,
    role: 'patient',
    gender: (() => {
      const raw =
        (typeof p.gender === 'string' && p.gender) ||
        (typeof u.gender === 'string' && u.gender) ||
        '';
      const normalized = raw.toLowerCase().trim();
      return (normalized || undefined) as Patient['gender'];
    })(),
    phoneNumber: phone,
    address:
      addressFromPatient ||
      (typeof u.address === 'string' && u.address.trim()) ||
      undefined,
    maritalStatus:
      (typeof p.maritalStatus === 'string' && p.maritalStatus) ||
      (typeof u.maritalStatus === 'string' && u.maritalStatus) ||
      undefined,
    language:
      (typeof p.language === 'string' && p.language) ||
      (typeof u.language === 'string' && u.language) ||
      undefined,
    dateOfBirth:
      convertTimestamp(p.dateOfBirth) || convertTimestamp(u.dateOfBirth) || undefined,
    assignedDoctorId:
      (typeof p.assignedDoctorId === 'string' && p.assignedDoctorId) ||
      (typeof u.assignedDoctorId === 'string' && u.assignedDoctorId) ||
      doctorId,
    rosterStatus:
      (typeof p.rosterStatus === 'string' && p.rosterStatus) ||
      (typeof u.rosterStatus === 'string' && u.rosterStatus) ||
      undefined,
    practiceId:
      (typeof p.practiceId === 'string' && p.practiceId) ||
      (typeof u.practiceId === 'string' && u.practiceId) ||
      undefined,
    emergencyContact:
      (p.emergencyContact as Patient['emergencyContact']) ||
      (u.emergencyContact as Patient['emergencyContact']) ||
      (typeof p.emergencyContactName === 'string' && p.emergencyContactName.trim()
        ? {
            name: p.emergencyContactName,
            phone:
              (typeof p.emergencyContactPhone === 'string' && p.emergencyContactPhone) ||
              '',
            relationship: '',
          }
        : undefined),
    medicalAid:
      (p.medicalAid as Patient['medicalAid']) ||
      medicalAidFromScheme ||
      (u.medicalAid as Patient['medicalAid']) ||
      undefined,
    bloodGroup:
      (typeof p.bloodGroup === 'string' && p.bloodGroup.trim()) ||
      (typeof u.bloodGroup === 'string' && u.bloodGroup.trim()) ||
      undefined,
    weight:
      (typeof p.weight === 'string' && p.weight.trim()) ||
      (typeof u.weight === 'string' && u.weight.trim()) ||
      (typeof p.weight === 'number' ? String(p.weight) : undefined) ||
      undefined,
    chronicDiseases: conditions,
    allergies,
    currentTreatments,
    createdAt:
      convertTimestamp(p.createdAt) ||
      convertTimestamp(u.createdAt) ||
      new Date(),
    updatedAt:
      convertTimestamp(p.updatedAt) ||
      convertTimestamp(u.updatedAt) ||
      new Date(),
  };
}
