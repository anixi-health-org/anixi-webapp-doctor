import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
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
                createdAt: doctorData.createdAt?.toDate() || new Date(),
                updatedAt: doctorData.updatedAt?.toDate() || new Date(),
            } as Doctor;
        }

        return null;
    } catch (error) {
        console.error('Get doctor profile error:', error);
        throw error;
    }
};

export const updateDoctorProfile = async (doctorId: string, updates: Partial<Doctor>): Promise<void> => {
    try {
        const doctorRef = doc(db, DOCTORS_COLLECTION, doctorId);
        await updateDoc(doctorRef, {
            ...updates,
            updatedAt: new Date(),
        });
    } catch (error) {
        console.error('Update doctor profile error:', error);
        throw error;
    }
};

export const diagnosticCheck = async () => {
    try {
        console.log('🔍 DIAGNOSTIC: Starting full Firestore structure scan...\n');
        
        const collectionsToCheck = ['Users', 'patients', 'doctors', 'caregivers'];
        
        for (const collName of collectionsToCheck) {
            console.log(`📋 Checking collection: "${collName}"`);
            const snapshot = await getDocs(collection(db, collName));
            console.log(`   Found ${snapshot.size} documents\n`);
            
            if (snapshot.size > 0) {
                let count = 0;
                snapshot.forEach((doc) => {
                    if (count < 3) { 

                        const allFields = Object.keys(doc.data());
                        console.log(`   Doc ${doc.id}:`);
                        console.log(`     Fields: ${allFields.join(', ')}`);
                        if (doc.data().role) console.log(`     role: ${doc.data().role}`);
                        if (doc.data().doctorId) console.log(`     doctorId: ${doc.data().doctorId}`);
                        if (doc.data().assignedDoctorId) console.log(`     assignedDoctorId: ${doc.data().assignedDoctorId}`);
                        if (doc.data().doctor_id) console.log(`     doctor_id: ${doc.data().doctor_id}`);
                        console.log('');
                    }
                    count++;
                });
            }
        }
        console.log('🔍 DIAGNOSTIC: Complete\n');
    } catch (error) {
        console.error('Diagnostic error:', error);
    }
};

export const getDoctorPatients = async (doctorId: string): Promise<Patient[]> => {
    try {
        console.log('👥============================================');
        console.log(`👥 FETCHING APPROVED PATIENTS FOR DOCTOR: ${doctorId}`);
        console.log('👥============================================\n');
        
        console.log('📍 STEP 1: Fetching approved_patients from subcollection...');
        console.log(`   Path: Users/${doctorId}/approved_patients\n`);
        
        const approvedPatientsRef = collection(db, 'Users', doctorId, 'approved_patients');
        const approvedSnapshot = await getDocs(approvedPatientsRef);
        
        console.log(`   ✓ Found ${approvedSnapshot.size} approved patients`);
        
        if (approvedSnapshot.size === 0) {
            console.log('   ℹ️ No approved patients for this doctor\n');
            return [];
        }
        
        const patientIds: string[] = [];
        approvedSnapshot.forEach((doc) => {
            const patientId = doc.data().patientId || doc.id;
            patientIds.push(patientId);
            console.log(`   - Approved patient ID: ${patientId}`);
        });
        
        console.log(`\n   ✓ Total approved patient IDs: ${patientIds.length}\n`);
        
        console.log('📍 STEP 2: Fetching full patient data from "patients" collection...\n');
        
        const patients: Patient[] = [];
        let successCount = 0;
        let missingCount = 0;
        
        const patientFetches = patientIds.map(async (patientId) => {
            try {
                const patientDoc = await getDoc(doc(db, 'patients', patientId));
                
                if (patientDoc.exists()) {
                    const patientData = patientDoc.data();
                    
                    const fullName = patientData.fullName || patientData.displayName || '';
                    const email = patientData.email || '';
                    
                    console.log(`   ✓ Found patient: ${patientId}`);
                    console.log(`     Name: ${fullName}`);
                    console.log(`     Email: ${email}`);
                    console.log(`     Phone: ${patientData.phoneNumber || 'N/A'}`);
                    console.log(`     Gender: ${patientData.gender || 'N/A'}`);
                    
                    console.log(`     [DEBUG] createdAt raw:`, patientData.createdAt);
                    console.log(`     [DEBUG] updatedAt raw:`, patientData.updatedAt);
                    
                    const createdAtConverted = convertTimestamp(patientData.createdAt);
                    const updatedAtConverted = convertTimestamp(patientData.updatedAt);
                    
                    console.log(`     [DEBUG] createdAt converted:`, createdAtConverted);
                    console.log(`     [DEBUG] updatedAt converted:`, updatedAtConverted);
                    
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
                    successCount++;
                } else {
                    console.warn(`   ⚠️ Patient document not found: ${patientId}`);
                    missingCount++;
                }
            } catch (error) {
                console.error(`   ❌ Error fetching patient ${patientId}:`, error);
                missingCount++;
            }
        });
        
        await Promise.all(patientFetches);
        
        console.log(`\n   ✓ Successfully fetched: ${successCount} patients`);
        if (missingCount > 0) {
            console.warn(`   ⚠️ Missing/failed: ${missingCount} patients`);
        }
        
        console.log(`\n✅ TOTAL PATIENTS FOR DASHBOARD: ${patients.length}\n`);
        
        return patients;
        
    } catch (error) {
        console.error('❌ Get doctor patients error:', error);
        return [];
    }
};

export const getDashboardStats = async (doctorId: string): Promise<DashboardStats> => {
    try {
        console.log('📊 getDashboardStats: Fetching patients for doctorId:', doctorId);
        const patients = await getDoctorPatients(doctorId);
        console.log('📊 getDashboardStats: Found', patients.length, 'patients');

        const totalPatients = patients.length;

        if (totalPatients === 0) {
            console.log('📊 No patients yet');
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
                console.log(`   📍 INACTIVE: ${patient.displayName} (last active: ${lastActive.toLocaleDateString()})`);
            } else {
                stableCount++;
                console.log(`   ✅ STABLE: ${patient.displayName}`);
            }
        });

        warningCount = Math.max(0, totalPatients - stableCount - inactiveCount);
        if (warningCount > 0) {
            console.log(`   ⚠️ WARNING: ${warningCount} patients may need attention`);
        }

        const stats = {
            totalPatients,
            warningPatients: warningCount,
            stablePatients: stableCount,
            inactivePatients: inactiveCount,
            upcomingAppointments: 0, 
        };

        console.log('📊 getDashboardStats: Returning stats:', stats);
        return stats;
    } catch (error) {
        console.error('❌ getDashboardStats error:', error);
        return {
            totalPatients: 0,
            warningPatients: 0,
            stablePatients: 0,
            inactivePatients: 0,
            upcomingAppointments: 0,
        };
    }
};
