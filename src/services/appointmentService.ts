import { 
  addDoc, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  orderBy,
  query, 
  serverTimestamp, 
  setDoc,
  Timestamp, 
  updateDoc, 
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION, APPOINTMENTS_COLLECTION } from '../shared/constants';
import { Appointment } from '../types';
import { convertTimestamp } from '../utils/dateFormatter';

const normalizeAppointmentTime = (timeValue: any, fallbackTimestamp?: any): string => {
  if (typeof timeValue === 'string' && timeValue.trim().length > 0) {
    return timeValue;
  }

  const convertedTime = convertTimestamp(timeValue);
  if (convertedTime) {
    return convertedTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  const fallbackTime = convertTimestamp(fallbackTimestamp);
  if (fallbackTime) {
    return fallbackTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  return '10:00 AM';
};

// Migration function to sync appointments from subcollections to global collection
export const migrateDoctorAppointmentsToGlobal = async (doctorId: string): Promise<number> => {
  try {
    let migratedCount = 0;

    const normalizeStatusLocal = (status: any): Appointment['status'] => {
      if (!status) return 'pending';
      const normalized = String(status).toLowerCase();
      const statusMap: { [key: string]: Appointment['status'] } = {
        'confirmed': 'confirmed',
        'pending': 'pending',
        'completed': 'completed',
        'cancelled': 'cancelled',
        'scheduled': 'pending',
      };
      return statusMap[normalized] || 'pending';
    };

    const normalizeTypeLocal = (type: any): Appointment['type'] => {
      if (!type) return 'In-Person';
      const normalized = String(type).toLowerCase();
      const typeMap: { [key: string]: Appointment['type'] } = {
        'in-person': 'In-Person',
        'in person': 'In-Person',
        'consultation': 'In-Person',
        'virtual': 'Virtual',
        'phone': 'Phone',
        'follow-up': 'Follow-up',
        'follow up': 'Follow-up',
        'followup': 'Follow-up',
      };
      return typeMap[normalized] || 'In-Person';
    };

    // Get appointments from doctor's subcollection
    const doctorAppointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
    const doctorSnapshot = await getDocs(doctorAppointmentsRef);

    for (const docSnap of doctorSnapshot.docs) {
      const data = docSnap.data();
      const appointmentId = docSnap.id;

      // Check if this appointment already exists in global collection
      const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
      const globalSnap = await getDoc(globalRef);

      if (!globalSnap.exists()) {
        // Migrate to global collection
        await setDoc(globalRef, {
          doctorId: doctorId,
          patientId: data.patientId || 'unknown',
          patientName: data.patientName || 'Patient',
          patientEmail: data.patientEmail || '',
          type: normalizeTypeLocal(data.type),
          status: normalizeStatusLocal(data.status),
          date: data.date,
          time: normalizeAppointmentTime(data.time, data.startAt || data.date),
          notes: data.notes || '',
          createdAt: data.createdAt || serverTimestamp(),
          updatedAt: data.updatedAt || serverTimestamp(),
        });
        migratedCount++;
      }
    }

    return migratedCount;
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
};
const normalizeType = (type: any): Appointment['type'] => {
  if (!type) return 'In-Person';
  const normalized = String(type).toLowerCase();
  const typeMap: { [key: string]: Appointment['type'] } = {
    'in-person': 'In-Person',
    'inperson': 'In-Person',
    'virtual': 'Virtual',
    'phone': 'Phone',
    'follow-up': 'Follow-up',
    'followup': 'Follow-up',
  };
  return typeMap[normalized] || 'In-Person';
};
const normalizeStatus = (status: any): Appointment['status'] => {
  if (!status) return 'pending';
  const normalized = String(status).toLowerCase();
  const statusMap: { [key: string]: Appointment['status'] } = {
    'confirmed': 'confirmed',
    'pending': 'pending',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'scheduled': 'pending', 
  };
  return statusMap[normalized] || 'pending';
};
export const getDoctorAppointments = async (doctorId: string): Promise<Appointment[]> => {
  try {
    const appointments: Appointment[] = [];
    
    // First, try to read from global appointments collection (PRIMARY SOURCE)
    try {
      const globalAppointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
      const q = query(
        globalAppointmentsRef,
        where('doctorId', '==', doctorId)
      );
      const globalSnapshot = await getDocs(q);
      globalSnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          appointments.push({
            id: doc.id,
            doctorId: data.doctorId,
            patientId: data.patientId || 'unknown',
            patientName: data.patientName || 'Patient',
            patientEmail: data.patientEmail || '',
            type: normalizeType(data.type),
            status: normalizeStatus(data.status),
            date: convertTimestamp(data.date) || new Date(),
            time: normalizeAppointmentTime(data.time, data.startAt || data.date),
            notes: data.notes || '',
            isManual: data.isManual ?? false,
            startAt: convertTimestamp(data.startAt) || undefined,
            endAt: convertTimestamp(data.endAt) || undefined,
            createdAt: convertTimestamp(data.createdAt) || convertTimestamp(data.date) || new Date(),
            updatedAt: convertTimestamp(data.updatedAt) || convertTimestamp(data.date) || new Date(),
          });
        } catch (error) {
          console.error('Error parsing global appointment:', error);
        }
      });
    } catch (error) {
    }
    
    // Also read from doctor's subcollection for backward compatibility and sync check
    try {
      const doctorAppointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
      const doctorSnapshot = await getDocs(doctorAppointmentsRef);
      doctorSnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          // Check if this appointment is already in the list (avoid duplicates)
          const exists = appointments.some(apt => apt.id === doc.id);
          if (!exists) {
            // This appointment exists in subcollection but not in global - add it
            // Note: This is normal during transition period
            appointments.push({
              id: doc.id,
              doctorId: doctorId,
              patientId: data.patientId || 'unknown',
              patientName: data.patientName || 'Patient',
              patientEmail: data.patientEmail || '',
              type: normalizeType(data.type),
              status: normalizeStatus(data.status),
              date: convertTimestamp(data.date) || new Date(),
              time: normalizeAppointmentTime(data.time, data.startAt || data.date),
              notes: data.notes || '',
              isManual: data.isManual ?? false,
              startAt: convertTimestamp(data.startAt) || undefined,
              endAt: convertTimestamp(data.endAt) || undefined,
              createdAt: convertTimestamp(data.createdAt) || convertTimestamp(data.date) || new Date(),
              updatedAt: convertTimestamp(data.updatedAt) || convertTimestamp(data.date) || new Date(),
            });
          }
        } catch (error) {
          console.error('Error parsing doctor subcollection appointment:', error);
        }
      });
    } catch (error) {
    }
    
    // Sort by date descending (most recent first)
    const sorted = appointments.sort((a, b) => b.date.getTime() - a.date.getTime());
    return sorted;
  } catch (error) {
    console.error('Error in getDoctorAppointments:', error);
    throw error;
  }
};
export const getAppointmentById = async (
  doctorId: string,
  appointmentId: string
): Promise<Appointment | null> => {
  try {
    const appointmentRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
    const appointmentDoc = await getDoc(appointmentRef);
    if (!appointmentDoc.exists()) {
      ;
      return null;
    }
    const data = appointmentDoc.data();
    const appointment: Appointment = {
      id: appointmentDoc.id,
      doctorId: doctorId,
      patientId: data.patientId || 'unknown',
      patientName: data.patientName || 'Patient',
      patientEmail: data.patientEmail || '',
      type: normalizeType(data.type),
      status: normalizeStatus(data.status),
      date: convertTimestamp(data.date) || new Date(),
      time: normalizeAppointmentTime(data.time, data.startAt || data.date),
      notes: data.notes || '',
      createdAt: convertTimestamp(data.createdAt) || convertTimestamp(data.date) || new Date(),
      updatedAt: convertTimestamp(data.updatedAt) || convertTimestamp(data.date) || new Date(),
    };
    return appointment;
  } catch (error) {
    ;
    throw error;
  }
};
export const createAppointment = async (data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    if (!data.doctorId || !data.patientName || !data.date || !data.time) {
      throw new Error('Doctor ID, patient name, date, and time are required');
    }
    
    // Create in global appointments collection for mobile apps
    const globalAppointmentRef = collection(db, APPOINTMENTS_COLLECTION);
    const globalDocRef = await addDoc(globalAppointmentRef, {
      doctorId: data.doctorId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientEmail: data.patientEmail,
      type: normalizeType(data.type),
      status: normalizeStatus(data.status),
      date: Timestamp.fromDate(data.date),
      time: data.time,
      notes: data.notes || '',
      isManual: data.isManual ?? false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Create in doctor's subcollection
    const doctorAppointmentRef = doc(db, USERS_COLLECTION, data.doctorId, 'appointments', globalDocRef.id);
    await setDoc(doctorAppointmentRef, {
      patientId: data.patientId,
      patientName: data.patientName,
      patientEmail: data.patientEmail,
      type: normalizeType(data.type),
      status: normalizeStatus(data.status),
      date: Timestamp.fromDate(data.date),
      time: data.time,
      notes: data.notes || '',
      isManual: data.isManual ?? false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Create in patient's subcollection (only for Anixi patients)
    if (data.patientId && !data.isManual) {
      const patientAppointmentRef = doc(db, USERS_COLLECTION, data.patientId, 'appointments', globalDocRef.id);
      await setDoc(patientAppointmentRef, {
        doctorId: data.doctorId,
        patientId: data.patientId,
        patientName: data.patientName,
        patientEmail: data.patientEmail,
        type: normalizeType(data.type),
        status: normalizeStatus(data.status),
        date: Timestamp.fromDate(data.date),
        time: data.time,
        notes: data.notes || '',
        isManual: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    
    return globalDocRef.id;
  } catch (error) {
    ;
    throw error;
  }
};
// Enhanced updateAppointment with better cross-collection synchronization
export const updateAppointment = async (
  doctorId: string,
  appointmentId: string,
  updates: Partial<Appointment>
): Promise<void> => {
  try {

    // Strategy: Find the appointment in any collection and update ALL collections
    let appointmentData: any = null;
    let foundPatientId: string | undefined;

    // 1. Try doctor's subcollection first
    const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
    const doctorSnap = await getDoc(doctorRef);
    if (doctorSnap.exists()) {
      appointmentData = doctorSnap.data();
      foundPatientId = appointmentData.patientId;
    }

    // 2. If not found, try global collection
    if (!appointmentData) {
      const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
      const globalSnap = await getDoc(globalRef);
      if (globalSnap.exists()) {
        appointmentData = globalSnap.data();
        foundPatientId = appointmentData.patientId;
      }
    }

    // 3. If still not found, search by doctorId in global collection
    if (!appointmentData) {
      const globalQuery = query(
        collection(db, APPOINTMENTS_COLLECTION),
        where('doctorId', '==', doctorId)
      );
      const globalSnapshot = await getDocs(globalQuery);

      // Find appointment by matching criteria
      for (const doc of globalSnapshot.docs) {
        const data = doc.data();
        // Match by patient info or other criteria
        if (data.patientId === updates.patientId ||
            (updates.date && data.date?.toDate?.().toDateString() === updates.date.toDateString())) {
          appointmentData = data;
          foundPatientId = data.patientId;
          // Use the global collection ID as the master ID
          appointmentId = doc.id;
          break;
        }
      }
    }

    if (!appointmentData) {
      throw new Error(`Appointment ${appointmentId} not found in any collection for doctor ${doctorId}`);
    }

    // Prepare update data
    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp(),
    };
    if (updates.status) {
      updateData.status = normalizeStatus(updates.status);
    }
    if (updates.type) {
      updateData.type = normalizeType(updates.type);
    }
    if (updates.date) {
      updateData.date = Timestamp.fromDate(updates.date);
    }
    delete updateData.id;
    delete updateData.doctorId;
    delete updateData.createdAt;

    // Update ALL collections using the master appointmentId
    const updatePromises = [];

    // 1. Update global collection (most important for mobile)
    const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    updatePromises.push(
      updateDoc(globalRef, updateData).catch(async (error) => {
        const fullData = {
          doctorId,
          patientId: foundPatientId,
          ...appointmentData,
          ...updateData,
        };
        return setDoc(globalRef, fullData);
      })
    );

    // 2. Update doctor's subcollection
    const doctorAppointmentRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
    updatePromises.push(
      updateDoc(doctorAppointmentRef, updateData).catch(async (error) => {
        const fullData = {
          patientId: foundPatientId,
          ...appointmentData,
          ...updateData,
        };
        return setDoc(doctorAppointmentRef, fullData);
      })
    );

    // 3. Update patient's subcollection (CRITICAL for mobile app)
    if (foundPatientId) {
      const patientRef = doc(db, USERS_COLLECTION, foundPatientId, 'appointments', appointmentId);
      updatePromises.push(
        updateDoc(patientRef, updateData).catch(async (error) => {
          const fullData = {
            doctorId,
            patientId: foundPatientId,
            ...appointmentData,
            ...updateData,
          };
          return setDoc(patientRef, fullData);
        })
      );
    }

    // Wait for all updates
    await Promise.all(updatePromises);

  } catch (error) {
    console.error('❌ Error updating appointment:', error);
    throw error;
  }
};
export const syncAppointmentStatus = async (appointmentId: string): Promise<void> => {
  try {

    // Get data from all possible locations
    const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    const globalSnap = await getDoc(globalRef);

    let masterData: any = null;
    let masterSource = '';

    // Check global collection first (preferred source for mobile apps)
    if (globalSnap.exists()) {
      masterData = globalSnap.data();
      masterSource = 'global';
    }

    // If no global data, check all doctor subcollections
    if (!masterData) {
      // This is more complex - we'd need to find the doctor ID
      // For now, we'll focus on syncing from global to subcollections
      return;
    }

    const doctorId = masterData.doctorId;
    const patientId = masterData.patientId;

    // Sync to doctor's subcollection
    if (doctorId) {
      const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
      await setDoc(doctorRef, masterData, { merge: true });
    }

    // Sync to patient's subcollection (critical for mobile app)
    if (patientId) {
      const patientRef = doc(db, USERS_COLLECTION, patientId, 'appointments', appointmentId);
      await setDoc(patientRef, masterData, { merge: true });
    }

  } catch (error) {
    console.error('Error syncing appointment:', error);
  }
};

// New function to sync all appointments for a doctor
export const syncAllDoctorAppointments = async (doctorId: string): Promise<void> => {
  try {

    // Get all appointments from global collection for this doctor
    const globalAppointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(globalAppointmentsRef, where('doctorId', '==', doctorId));
    const globalSnapshot = await getDocs(q);

    const syncPromises = globalSnapshot.docs.map(async (appointmentDoc) => {
      const appointmentId = appointmentDoc.id;
      const masterData = appointmentDoc.data();

      // Sync to doctor's subcollection
      const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
      await setDoc(doctorRef, masterData, { merge: true });

      // Sync to patient's subcollection if patient exists
      const patientId = masterData.patientId;
      if (patientId) {
        const patientRef = doc(db, USERS_COLLECTION, patientId, 'appointments', appointmentId);
        await setDoc(patientRef, masterData, { merge: true });
      }

    });

    await Promise.all(syncPromises);
  } catch (error) {
    console.error('Error in bulk sync:', error);
  }
};

// Function to diagnose synchronization issues
export const diagnoseAppointmentSync = async (doctorId: string): Promise<{
  globalCount: number;
  doctorSubCount: number;
  inconsistencies: any[];
}> => {
  try {

    // Get global appointments
    const globalAppointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const globalQuery = query(globalAppointmentsRef, where('doctorId', '==', doctorId));
    const globalSnapshot = await getDocs(globalQuery);
    const globalAppointments = globalSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    // Get doctor subcollection appointments
    const doctorAppointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
    const doctorSnapshot = await getDocs(doctorAppointmentsRef);
    const doctorAppointments = doctorSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    const inconsistencies = [];

    // Check for appointments in global but not in doctor subcollection
    for (const globalApt of globalAppointments) {
      const inDoctorSub = doctorAppointments.find(apt => apt.id === globalApt.id);
      if (!inDoctorSub) {
        inconsistencies.push({
          type: 'missing_in_doctor_sub',
          appointmentId: globalApt.id,
          globalData: globalApt
        });
      } else {
        // Check if status matches
        if (globalApt.status !== inDoctorSub.status) {
          inconsistencies.push({
            type: 'status_mismatch',
            appointmentId: globalApt.id,
            globalStatus: globalApt.status,
            doctorSubStatus: inDoctorSub.status
          });
        }
      }
    }

    // Check for appointments in doctor subcollection but not in global
    for (const doctorApt of doctorAppointments) {
      const inGlobal = globalAppointments.find(apt => apt.id === doctorApt.id);
      if (!inGlobal) {
        inconsistencies.push({
          type: 'missing_in_global',
          appointmentId: doctorApt.id,
          doctorSubData: doctorApt
        });
      }
    }

    return {
      globalCount: globalAppointments.length,
      doctorSubCount: doctorAppointments.length,
      inconsistencies
    };
  } catch (error) {
    console.error('Error diagnosing sync:', error);
    throw error;
  }
};

// Function to simulate what mobile app sees
export const getMobileAppAppointments = async (doctorId: string): Promise<Appointment[]> => {
  try {
    
    // Mobile app reads from doctor subcollection only
    const doctorAppointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
    const q = query(
      doctorAppointmentsRef,
      where('status', 'in', ['pending', 'confirmed']),
      orderBy('date', 'asc'),
      orderBy('time', 'asc'),
    );
    
    const snapshot = await getDocs(q);
    const appointments: Appointment[] = [];
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      try {
        appointments.push({
          id: doc.id,
          doctorId: doctorId,
          patientId: data.patientId || 'unknown',
          patientName: data.patientName || 'Patient',
          patientEmail: data.patientEmail || '',
          type: normalizeType(data.type),
          status: normalizeStatus(data.status),
          date: convertTimestamp(data.date) || new Date(),
          time: data.time || '10:00 AM',
          notes: data.notes || '',
          createdAt: convertTimestamp(data.createdAt) || convertTimestamp(data.date) || new Date(),
          updatedAt: convertTimestamp(data.updatedAt) || convertTimestamp(data.date) || new Date(),
        });
      } catch (error) {
        console.error('Error parsing mobile appointment:', error);
      }
    });
    
    return appointments;
  } catch (error) {
    console.error('Error simulating mobile app:', error);
    throw error;
  }
};

export const getPatientAppointments = async (patientId: string): Promise<Appointment[]> => {
  try {
    const appointments: Appointment[] = [];

    // First, try to read from patient's subcollection
    try {
      const patientAppointmentsRef = collection(db, USERS_COLLECTION, patientId, 'appointments');
      const patientSnapshot = await getDocs(patientAppointmentsRef);
      patientSnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          appointments.push({
            id: doc.id,
            doctorId: data.doctorId,
            patientId: data.patientId,
            patientName: data.patientName || 'Patient',
            patientEmail: data.patientEmail || '',
            type: normalizeType(data.type),
            status: normalizeStatus(data.status),
            date: convertTimestamp(data.date) || new Date(),
            time: data.time || '10:00 AM',
            notes: data.notes || '',
            createdAt: convertTimestamp(data.createdAt) || new Date(),
            updatedAt: convertTimestamp(data.updatedAt) || new Date(),
          });
        } catch (error) {
        }
      });
    } catch (error) {
    }

    // Also read from global appointments collection to ensure no appointments are missed
    try {
      const globalAppointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
      const q = query(globalAppointmentsRef, where('patientId', '==', patientId));
      const globalSnapshot = await getDocs(q);
      globalSnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          // Check if this appointment is already in the list (avoid duplicates)
          const exists = appointments.some(apt => apt.id === doc.id);
          if (!exists) {
            appointments.push({
              id: doc.id,
              doctorId: data.doctorId,
              patientId: data.patientId,
              patientName: data.patientName || 'Patient',
              patientEmail: data.patientEmail || '',
              type: normalizeType(data.type),
              status: normalizeStatus(data.status),
              date: convertTimestamp(data.date) || new Date(),
              time: data.time || '10:00 AM',
              notes: data.notes || '',
              createdAt: convertTimestamp(data.createdAt) || new Date(),
              updatedAt: convertTimestamp(data.updatedAt) || new Date(),
            });
          }
        } catch (error) {
        }
      });
    } catch (error) {
    }

    const sorted = appointments.sort((a, b) => b.date.getTime() - a.date.getTime());
    return sorted;
  } catch (error) {
    console.error('Error getting patient appointments:', error);
    throw error;
  }
};

// Function to find and fix inconsistent appointments
export const fixInconsistentAppointments = async (): Promise<void> => {
  try {

    // Get all appointments from global collection
    const globalAppointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const globalSnapshot = await getDocs(globalAppointmentsRef);

    let fixedCount = 0;

    for (const globalDoc of globalSnapshot.docs) {
      const appointmentId = globalDoc.id;
      const globalData = globalDoc.data();
      const doctorId = globalData.doctorId;
      const patientId = globalData.patientId;

      // Check doctor's subcollection
      if (doctorId) {
        const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
        const doctorSnap = await getDoc(doctorRef);

        if (doctorSnap.exists()) {
          const doctorData = doctorSnap.data();
          // Compare status
          if (doctorData?.status !== globalData.status) {
            await setDoc(doctorRef, globalData, { merge: true });
            fixedCount++;
          }
        } else {
          // Doctor subcollection missing, create it
          await setDoc(doctorRef, globalData);
          fixedCount++;
        }
      }

      // Check patient's subcollection
      if (patientId) {
        const patientRef = doc(db, USERS_COLLECTION, patientId, 'appointments', appointmentId);
        const patientSnap = await getDoc(patientRef);

        if (patientSnap.exists()) {
          const patientData = patientSnap.data();
          // Compare status
          if (patientData?.status !== globalData.status) {
            await setDoc(patientRef, globalData, { merge: true });
            fixedCount++;
          }
        } else {
          // Patient subcollection missing, create it
          await setDoc(patientRef, globalData);
          fixedCount++;
        }
      }
    }

  } catch (error) {
    console.error('Error fixing inconsistent appointments:', error);
  }
};

// Auto-sync function that can be called periodically
export const autoSyncAppointments = async (): Promise<void> => {
  try {
    await fixInconsistentAppointments();
  } catch (error) {
    console.error('Auto-sync failed:', error);
  }
};

// Initialize appointment sync service
export const initializeAppointmentSync = (): void => {

  // Run initial sync after a short delay to ensure Firebase is ready
  setTimeout(() => {
    autoSyncAppointments();
  }, 5000);

  // Set up periodic sync every 30 minutes
  setInterval(() => {
    autoSyncAppointments();
  }, 30 * 60 * 1000);

};

// Function to check for appointment conflicts
export const checkAppointmentConflict = async (
  doctorId: string,
  date: Date,
  time: string,
  excludeAppointmentId?: string
): Promise<boolean> => {
  try {

    // Query global appointments collection for this doctor on this date
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('doctorId', '==', doctorId),
      where('date', '==', Timestamp.fromDate(date))
    );

    const snapshot = await getDocs(q);

    // Check for time conflicts
    for (const doc of snapshot.docs) {
      const appointment = doc.data();

      // Skip the appointment we're updating (if any)
      if (excludeAppointmentId && doc.id === excludeAppointmentId) {
        continue;
      }

      // Check if the time matches
      if (appointment.time === time) {
        return true;
      }
    }

    // Also check doctor's subcollection as backup
    try {
      const doctorAppointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
      const doctorQuery = query(
        doctorAppointmentsRef,
        where('date', '==', Timestamp.fromDate(date))
      );

      const doctorSnapshot = await getDocs(doctorQuery);

      for (const doc of doctorSnapshot.docs) {
        const appointment = doc.data();

        // Skip the appointment we're updating (if any)
        if (excludeAppointmentId && doc.id === excludeAppointmentId) {
          continue;
        }

        // Check if the time matches
        if (appointment.time === time) {
          return true;
        }
      }
    } catch (error) {
    }

    return false;
  } catch (error) {
    console.error('Error checking appointment conflict:', error);
    // In case of error, assume no conflict to not block the operation
    return false;
  }
};
