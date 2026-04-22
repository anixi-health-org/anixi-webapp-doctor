import { 
  addDoc, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  serverTimestamp, 
  Timestamp, 
  updateDoc, 
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APPOINTMENTS_COLLECTION, USERS_COLLECTION } from '../shared/constants';
import { Appointment } from '../types';
import { convertTimestamp, formatTimeFromDate } from '../utils/dateFormatter';
const normalizeStatus = (status: any): Appointment['status'] => {
  if (!status) return 'Pending';
  const normalized = String(status).toLowerCase();
  const statusMap: { [key: string]: Appointment['status'] } = {
    'confirmed': 'Confirmed',
    'pending': 'Pending',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'scheduled': 'Pending', 
  };
  return statusMap[normalized] || 'Pending';
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
export const getDoctorAppointments = async (doctorId: string): Promise<Appointment[]> => {
  try {
    const appointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
    const snapshot = await getDocs(appointmentsRef);
    const appointments: Appointment[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      try {
        let timeDisplay = '10:00 AM';
        if (data.time) {
          const convertedTime = formatTimeFromDate(data.time);
          if (convertedTime !== '10:00 AM') {
            timeDisplay = convertedTime;
          }
        }
        const appointment: Appointment = {
          id: doc.id,
          doctorId: doctorId,
          patientId: data.patientId || 'unknown',
          patientName: data.patientName || 'Patient',
          patientEmail: data.patientEmail || '',
          type: normalizeType(data.type),
          status: normalizeStatus(data.status),
          date: convertTimestamp(data.date) || new Date(),
          time: timeDisplay,
          notes: data.notes || '',
          createdAt: convertTimestamp(data.createdAt) || convertTimestamp(data.date) || new Date(),
          updatedAt: convertTimestamp(data.updatedAt) || convertTimestamp(data.date) || new Date(),
        };
        appointments.push(appointment);
      } catch (error) {
        ;
      }
    });
    const sorted = appointments.sort((a, b) => b.date.getTime() - a.date.getTime());
    return sorted;
  } catch (error) {
    ;
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
      time: data.time ? formatTimeFromDate(data.time) : '10:00 AM',
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
    const appointmentRef = collection(db, USERS_COLLECTION, data.doctorId, 'appointments');
    const docRef = await addDoc(appointmentRef, {
      patientId: data.patientId,
      patientName: data.patientName,
      patientEmail: data.patientEmail,
      type: normalizeType(data.type),
      status: normalizeStatus(data.status),
      date: Timestamp.fromDate(data.date),
      time: data.time,
      notes: data.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    ;
    throw error;
  }
};
export const updateAppointment = async (
  doctorId: string,
  appointmentId: string,
  updates: Partial<Appointment>
): Promise<void> => {
  try {
    const appointmentRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
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
    await updateDoc(appointmentRef, updateData);
  } catch (error) {
    ;
    throw error;
  }
};
export const checkAppointmentConflict = async (
  doctorId: string,
  date: Date,
  time: string,
  excludeAppointmentId?: string
): Promise<boolean> => {
  try {
    const appointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
    const q = query(
      appointmentsRef,
      where('date', '==', Timestamp.fromDate(date)),
      where('status', 'in', ['Confirmed', 'Pending'])
    );
    const snapshot = await getDocs(q);
    const conflicts = snapshot.docs.filter(doc => {
      if (excludeAppointmentId && doc.id === excludeAppointmentId) return false;
      const data = doc.data();
      return data.time === time;
    });
    const hasConflict = conflicts.length > 0;
    return hasConflict;
  } catch (error) {
    ;
    throw error;
  }
};

export const getPatientAppointments = async (patientId: string): Promise<Appointment[]> => {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('patientId', '==', patientId)
    );
    const snapshot = await getDocs(q);
    const appointments: Appointment[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      appointments.push({
        id: doc.id,
        doctorId: data.doctorId,
        patientId: data.patientId,
        patientName: data.patientName || 'Patient',
        patientEmail: data.patientEmail || '',
        type: data.type || 'In-Person',
        status: data.status || 'Pending',
        date: convertTimestamp(data.date) || new Date(),
        time: data.time || '10:00 AM',
        notes: data.notes || '',
        createdAt: convertTimestamp(data.createdAt) || new Date(),
        updatedAt: convertTimestamp(data.updatedAt) || new Date(),
      });
    });
    return appointments.sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (error) {
    ;
    throw error;
  }
};
