import { collection, doc, getDoc, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DOCTORS_COLLECTION } from '../shared/constants';
import { DashboardStats, Doctor, Patient } from '../types';
import { convertTimestamp } from '../utils/dateFormatter';
export const getDoctorProfile = async (doctorId: string): Promise<Doctor | null> => {
    try {
        const doctorDoc = await getDoc(doc(db, DOCTORS_COLLECTION, doctorId));
        if (doctorDoc.exists()) {
            const doctorData = doctorDoc.data();
            return {
                id: doctorDoc.id,
                email: doctorData.email,
                displayName: doctorData.displayName,
                role: 'doctor',
                specialty: doctorData.specialty,
                licenseNumber: doctorData.licenseNumber,
                phoneNumber: doctorData.phoneNumber,
                officeAddress: doctorData.officeAddress,
                practiceName: doctorData.practiceName,
                logoUrl: doctorData.logoUrl,
                createdAt: doctorData.createdAt?.toDate() || new Date(),
                updatedAt: doctorData.updatedAt?.toDate() || new Date(),
            } as Doctor;
        }
        return null;
    } catch (error) {
        ;
        throw error;
    }
};
export const updateDoctorProfile = async (doctorId: string, updates: Partial<Doctor>): Promise<void> => {
    try {
        const doctorRef = doc(db, DOCTORS_COLLECTION, doctorId);
        await updateDoc(doctorRef, {
            ...updates,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        ;
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
                    const fullName = patientData.fullName || patientData.displayName || '';
                    const email = patientData.email || '';
                    const createdAtConverted = convertTimestamp(patientData.createdAt);
                    const updatedAtConverted = convertTimestamp(patientData.updatedAt);
                    patients.push({
                        id: patientDoc.id,
                        email: email,
                        displayName: fullName, 
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
