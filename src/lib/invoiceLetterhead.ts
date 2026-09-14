import type { Practice } from '../types';

export interface DoctorLetterheadData {
  doctorId?: string;
  displayName: string;
  specialty?: string;
  licenseNumber?: string;
  practiceNumberBhf?: string;
  vatNumber?: string;
  phoneNumber?: string;
  email?: string;
  officeAddress?: string;
  logoUrl?: string;
  /** Face photo, only used for letterhead when it is actually a stored practice logo. */
  profileImageUrl?: string;
  practiceName?: string;
  /**
   * Optional pre-encoded logo (data:image/...;base64,...). When set, PDF skips
   * network logo loading, use this when the UI already has the logo on screen.
   */
  logoDataUrl?: string;
  /**
   * Clinic/hospital invoices use organisation branding. Independent doctors use
   * their own profile letterhead. Enrichment must not overwrite practice branding.
   */
  brandingSource?: 'practice' | 'doctor';
}

export type PracticeLetterheadSource = {
  orgType?: string;
  name?: string;
  tradingName?: string;
  logoUrl?: string;
  bhfPracticeNumber?: string;
  locations?: Array<{ address?: string }>;
};

export type DoctorLetterheadSource = {
  id?: string;
  displayName?: string;
  specialty?: string;
  licenseNumber?: string;
  practiceNumberBhf?: string;
  vatNumber?: string;
  phoneNumber?: string;
  email?: string;
  officeAddress?: string;
  logoUrl?: string;
  profileImageUrl?: string;
  practiceName?: string;
};

export function buildDoctorLetterheadFromUser(
  doctor: DoctorLetterheadSource | null | undefined
): DoctorLetterheadData {
  return {
    doctorId: doctor?.id,
    displayName: doctor?.displayName || 'Doctor',
    specialty: doctor?.specialty,
    licenseNumber: doctor?.licenseNumber,
    practiceNumberBhf: doctor?.practiceNumberBhf,
    vatNumber: doctor?.vatNumber,
    phoneNumber: doctor?.phoneNumber,
    email: doctor?.email,
    officeAddress: doctor?.officeAddress,
    logoUrl: doctor?.logoUrl,
    profileImageUrl: doctor?.profileImageUrl,
    practiceName: doctor?.practiceName,
    brandingSource: 'doctor',
  };
}

export function buildPracticeLetterhead(
  practice: PracticeLetterheadSource | null | undefined,
  doctor?: DoctorLetterheadSource | null,
  treatingClinicianName?: string
): DoctorLetterheadData {
  const primaryAddress = practice?.locations?.[0]?.address?.trim();
  return {
    doctorId: doctor?.id,
    displayName: treatingClinicianName || doctor?.displayName || 'Clinician',
    specialty: doctor?.specialty,
    licenseNumber: doctor?.licenseNumber,
    practiceNumberBhf: practice?.bhfPracticeNumber || doctor?.practiceNumberBhf,
    vatNumber: doctor?.vatNumber,
    phoneNumber: doctor?.phoneNumber,
    email: doctor?.email,
    officeAddress: primaryAddress || doctor?.officeAddress,
    logoUrl: practice?.logoUrl,
    practiceName: (practice?.tradingName || practice?.name || '').trim() || 'Clinic',
    brandingSource: 'practice',
  };
}

export function buildInvoiceLetterhead(params: {
  doctor?: DoctorLetterheadSource | null;
  practice?: PracticeLetterheadSource | null;
  treatingClinicianName?: string;
}): DoctorLetterheadData {
  if (params.practice?.orgType === 'clinic') {
    return buildPracticeLetterhead(
      params.practice,
      params.doctor,
      params.treatingClinicianName
    );
  }
  return buildDoctorLetterheadFromUser(params.doctor);
}

export const CLINIC_LETTERHEAD_FIELDS = [
  { key: 'logoUrl', label: 'Clinic logo' },
  { key: 'practiceName', label: 'Clinic name' },
  { key: 'officeAddress', label: 'Clinic address' },
] as const;

export function getMissingClinicLetterheadFields(practice: Practice | null | undefined) {
  if (!practice) return [...CLINIC_LETTERHEAD_FIELDS];
  const values: Record<(typeof CLINIC_LETTERHEAD_FIELDS)[number]['key'], string> = {
    logoUrl: String(practice.logoUrl ?? '').trim(),
    practiceName: String(practice.tradingName || practice.name || '').trim(),
    officeAddress: String(practice.locations?.[0]?.address ?? '').trim(),
  };
  return CLINIC_LETTERHEAD_FIELDS.filter(({ key }) => !values[key]);
}
