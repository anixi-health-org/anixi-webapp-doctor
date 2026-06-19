import {
  collection,
  getDocs,
  limit,
  query,
  QueryConstraint,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DOCTORS_COLLECTION } from '../../shared/constants';
import { DoctorSearchResult } from './types';

export interface SearchDoctorsFilters {
  medicalSpecialty?: string;
  practiceCity?: string;
  maxResults?: number;
}

const toDate = (value: unknown): Date => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
};

export const searchDoctors = async (
  filters: SearchDoctorsFilters = {}
): Promise<DoctorSearchResult[]> => {
  const maxResults = filters.maxResults ?? 20;
  const constraints: QueryConstraint[] = [limit(maxResults)];

  if (filters.medicalSpecialty?.trim()) {
    constraints.unshift(where('medicalSpecialty', '==', filters.medicalSpecialty.trim()));
  }
  if (filters.practiceCity?.trim()) {
    constraints.unshift(where('practiceCity', '==', filters.practiceCity.trim()));
  }

  const doctorsRef = collection(db, DOCTORS_COLLECTION);
  const q = query(doctorsRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      displayName:
        data.displayName ||
        data.fullName ||
        data.name ||
        'Doctor',
      email: data.email,
      medicalSpecialty: data.medicalSpecialty || data.specialty,
      practiceCity: data.practiceCity || data.city,
      yearsInPractice: data.yearsInPractice ?? data.yearsOfExperience,
      phoneNumber: data.phoneNumber,
      officeAddress: data.officeAddress || data.practiceAddress,
    };
  });
};

export { toDate as sharingTimestampToDate };
