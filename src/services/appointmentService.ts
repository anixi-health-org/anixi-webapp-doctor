import { addDoc, collection, collectionGroup, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APPOINTMENTS_COLLECTION, USERS_COLLECTION } from '../shared/constants';
import { Appointment } from '../types';

export const getDoctorAppointments = async (doctorId: string): Promise<Appointment[]> => {
    try {
        console.log(`[getDoctorAppointments] Fetching appointments for doctorId: ${doctorId}`);

        
        const appointmentsQuery = query(
            collectionGroup(db, 'appointments'),
            where('doctorId', '==', doctorId)
        );

        const querySnapshot = await getDocs(appointmentsQuery);
        console.log(`[getDoctorAppointments] Found ${querySnapshot.size} appointments`);

        const appointments: Appointment[] = [];

        querySnapshot.forEach((doc) => {
            const appointmentData = doc.data();
            
            if (!appointmentData.doctorId || !appointmentData.patientId) {
                console.warn(`[getDoctorAppointments] Skipping document ${doc.id} - missing required fields`);
                return;
            }

            try {
                appointments.push({
                    id: doc.id,
                    doctorId: appointmentData.doctorId,
                    patientId: appointmentData.patientId,
                    title: appointmentData.title || 'Untitled',
                    description: appointmentData.description || '',
                    startTime: appointmentData.startTime?.toDate?.() || new Date(),
                    endTime: appointmentData.endTime?.toDate?.() || new Date(),
                    status: appointmentData.status || 'scheduled',
                    type: appointmentData.type || 'consultation',
                    notes: appointmentData.notes || '',
                    createdAt: appointmentData.createdAt?.toDate?.() || new Date(),
                    updatedAt: appointmentData.updatedAt?.toDate?.() || new Date(),
                } as Appointment);
            } catch (docError) {
                console.error(`[getDoctorAppointments] Error processing document ${doc.id}:`, docError);
            }
        });

        const seen = new Set<string>();
        let duplicateCount = 0;
        const deduplicated = appointments.filter((apt) => {
            const uniqueKey = `${apt.patientId}:${apt.id}`;
            if (seen.has(uniqueKey)) {
                duplicateCount++;
                return false;
            }
            seen.add(uniqueKey);
            return true;
        });

        const sorted = deduplicated.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
        console.log(`[getDoctorAppointments] ✓ Returned ${sorted.length} appointments (removed ${duplicateCount} duplicates from Firestore result)`);
        
        return sorted;
    } catch (error) {
        console.error('[getDoctorAppointments] Error fetching appointments:', error);
        throw error;
    }
};

export const getAppointment = async (appointmentId: string): Promise<Appointment | null> => {
    try {
        const appointmentDoc = await getDoc(doc(db, APPOINTMENTS_COLLECTION, appointmentId));

        if (appointmentDoc.exists()) {
            const appointmentData = appointmentDoc.data();
            return {
                id: appointmentDoc.id,
                doctorId: appointmentData.doctorId,
                patientId: appointmentData.patientId,
                title: appointmentData.title,
                description: appointmentData.description,
                startTime: appointmentData.startTime.toDate(),
                endTime: appointmentData.endTime.toDate(),
                status: appointmentData.status,
                type: appointmentData.type,
                notes: appointmentData.notes,
                createdAt: appointmentData.createdAt.toDate(),
                updatedAt: appointmentData.updatedAt.toDate(),
            } as Appointment;
        }

        return null;
    } catch (error) {
        console.error('Get appointment error:', error);
        throw error;
    }
};

export const createAppointment = async (appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, APPOINTMENTS_COLLECTION), {
            ...appointmentData,
            startTime: Timestamp.fromDate(appointmentData.startTime),
            endTime: Timestamp.fromDate(appointmentData.endTime),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });

        return docRef.id;
    } catch (error) {
        console.error('Create appointment error:', error);
        throw error;
    }
};

export const updateAppointmentStatus = async (
    patientId: string,
    appointmentId: string,
    status: Appointment['status']
): Promise<void> => {
    try {
        console.log(`[updateAppointmentStatus] Updating appointment ${appointmentId} for patient ${patientId} to status ${status}`);
        
        const appointmentRef = doc(db, USERS_COLLECTION, patientId, 'appointments', appointmentId);
        await updateDoc(appointmentRef, {
            status,
            updatedAt: Timestamp.now(),
        });
        
        console.log(`[updateAppointmentStatus] Successfully updated appointment`);
    } catch (error) {
        console.error('[updateAppointmentStatus] Error:', error);
        throw error;
    }
};
