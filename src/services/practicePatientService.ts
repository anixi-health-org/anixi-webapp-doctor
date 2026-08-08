import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Patient } from '../types';

const toDate = (v: unknown): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(String(v));
};

/**
 * Practice-level patient pool - patients tagged with practiceId.
 * Complements per-doctor approved_patients for clinic workflows.
 */
export const listPracticePatients = async (practiceId: string): Promise<Patient[]> => {
  if (!practiceId) return [];

  const q = query(collection(db, 'patients'), where('practiceId', '==', practiceId));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      email: data.email || '',
      displayName: data.displayName || data.fullName,
      role: 'patient' as const,
      photoURL: data.photoURL,
      dateOfBirth: toDate(data.dateOfBirth),
      gender: data.gender,
      phoneNumber: data.phoneNumber,
      assignedDoctorId: data.assignedDoctorId,
      practiceId: data.practiceId || practiceId,
      medicalAid: data.medicalAid,
      chronicDiseases: data.chronicDiseases,
      allergies: data.allergies,
      createdAt: toDate(data.createdAt) || new Date(),
      updatedAt: toDate(data.updatedAt) || new Date(),
    };
  });
};
