import { djangoSearchDoctors } from '../djangoApiService';
import { DoctorSearchResult } from './types';

export interface SearchDoctorsFilters {
  medicalSpecialty?: string;
  practiceCity?: string;
  maxResults?: number;
}

export const searchDoctors = async (
  filters: SearchDoctorsFilters = {},
): Promise<DoctorSearchResult[]> => {
  const rows = await djangoSearchDoctors(filters);
  return rows.map((row) => ({
    id: String(row.id),
    displayName: String(row.fullName ?? row.displayName ?? 'Doctor'),
    email: row.email as string | undefined,
    medicalSpecialty: (row.medicalSpecialty ?? row.specialty) as string | undefined,
    practiceCity: (row.practiceCity ?? row.city) as string | undefined,
    yearsInPractice: (row.yearsInPractice ?? row.yearsOfExperience) as number | undefined,
    phoneNumber: row.phoneNumber as string | undefined,
    officeAddress: (row.officeAddress ?? row.practiceAddress) as string | undefined,
  }));
};

export const sharingTimestampToDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') return toDate();
  }
  return new Date();
};
