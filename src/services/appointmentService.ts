import { 
  addDoc, 
  arrayUnion,
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  onSnapshot,
  orderBy,
  query, 
  serverTimestamp, 
  setDoc,
  Timestamp, 
  updateDoc, 
  where,
  type Unsubscribe
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { USERS_COLLECTION, APPOINTMENTS_COLLECTION, PRACTICES_COLLECTION, PRACTICE_APPOINTMENTS_SUBCOLLECTION } from '../shared/constants';
import { Appointment, AppointmentDocument, PostConsultAction, PostConsultActionType } from '../types';
import { convertTimestamp } from '../utils/dateFormatter';
import {
  assertAppointmentStatus,
  canAutoCancelStatus,
  effectiveAppointmentStatus,
  formatAppointmentClock,
  parseAppointmentStatus,
  resolveScheduledAt,
} from './appointmentCanonical';

const normalizeAppointmentTime = (data: Record<string, any>): string => {
  const instant = resolveScheduledAt(data);
  if (instant) {
    return formatAppointmentClock(instant);
  }
  if (typeof data.time === 'string' && data.time.trim().length > 0) {
    return data.time;
  }
  return 'Time unavailable';
};

export const migrateDoctorAppointmentsToGlobal = async (doctorId: string): Promise<number> => {
  try {
    let migratedCount = 0;

    
    const doctorAppointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
    const doctorSnapshot = await getDocs(doctorAppointmentsRef);

    for (const docSnap of doctorSnapshot.docs) {
      const data = docSnap.data();
      const appointmentId = docSnap.id;

      
      const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
      const globalSnap = await getDoc(globalRef);

      if (!globalSnap.exists()) {
        
        await setDoc(globalRef, {
          doctorId: doctorId,
          patientId: data.patientId || 'unknown',
          patientName: data.patientName || 'Patient',
          patientEmail: data.patientEmail || '',
          type: normalizeType(data.type),
          status: data.status,
          date: data.date,
          time: data.time,
          scheduledAt: data.scheduledAt || data.startAt || data.date,
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

const normalizeAppointmentDocuments = (value: any): AppointmentDocument[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => {
      if (!item || typeof item !== 'object') return null;
      const downloadURL = typeof item.downloadURL === 'string' ? item.downloadURL : '';
      const fileName = typeof item.fileName === 'string' ? item.fileName : 'document';
      if (!downloadURL) return null;
      return {
        id: typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: typeof item.title === 'string' ? item.title : undefined,
        fileName,
        fileType: typeof item.fileType === 'string' ? item.fileType : 'image/jpeg',
        fileSize: typeof item.fileSize === 'number' ? item.fileSize : 0,
        downloadURL,
        storagePath: typeof item.storagePath === 'string' ? item.storagePath : '',
        createdAt: convertTimestamp(item.createdAt) || new Date(),
        createdBy: typeof item.createdBy === 'string' ? item.createdBy : '',
      } as AppointmentDocument;
    })
    .filter((item): item is AppointmentDocument => item !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

const normalizePostConsultActions = (value: any): PostConsultAction[] => {
  if (!Array.isArray(value)) return [];

  const validTypes: PostConsultActionType[] = [
    'prescription_draft',
    'doctor_letter_draft',
    'medical_document',
    'session_recording',
    'post_consult_note',
  ];

  return value
    .map((item: any) => {
      if (!item || typeof item !== 'object') return null;
      const actionType = item.type as PostConsultActionType;
      if (!validTypes.includes(actionType)) return null;

      return {
        id: typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: actionType,
        title: typeof item.title === 'string' ? item.title : undefined,
        content: typeof item.content === 'string' ? item.content : '',
        status: item.status === 'finalized' ? 'finalized' : 'draft',
        metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : undefined,
        createdBy: typeof item.createdBy === 'string' ? item.createdBy : '',
        createdAt: convertTimestamp(item.createdAt) || new Date(),
        updatedAt: convertTimestamp(item.updatedAt) || convertTimestamp(item.createdAt) || new Date(),
      } as PostConsultAction;
    })
    .filter((item): item is PostConsultAction => item !== null)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
};

const normalizeTeleconsult = (value: any): Appointment['teleconsult'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  return {
    provider: value.provider === 'livekit' ? 'livekit' : undefined,
    roomName: typeof value.roomName === 'string' ? value.roomName : undefined,
    status: typeof value.status === 'string' ? value.status : undefined,
    doctorJoinedAt: convertTimestamp(value.doctorJoinedAt) || undefined,
    patientJoinedAt: convertTimestamp(value.patientJoinedAt) || undefined,
    endedAt: convertTimestamp(value.endedAt) || undefined,
    updatedAt: convertTimestamp(value.updatedAt) || undefined,
  };
};

const mapAppointmentFields = (
  id: string,
  doctorId: string,
  data: Record<string, any>
): Appointment => {
  const parsedStatus = parseAppointmentStatus(data.status);
  if (!parsedStatus) {
    throw new Error(
      `Unknown appointment status "${String(data.status)}" for ${id}`
    );
  }

  const instant = resolveScheduledAt(data);
  const date = instant ?? convertTimestamp(data.date);
  if (!date) {
    throw new Error(`Appointment ${id} has no scheduledAt or date`);
  }

  const editScope =
    data.editScope === 'slot' || data.editScope === 'visit_type'
      ? data.editScope
      : undefined;
  const requiresConfirmation =
    typeof data.requiresConfirmation === 'boolean'
      ? data.requiresConfirmation
      : undefined;
  const confirmedScheduledAt =
    convertTimestamp(data.confirmedScheduledAt) || undefined;

  const displayStatus =
    effectiveAppointmentStatus({
      status: parsedStatus,
      editScope,
      requiresConfirmation,
      confirmedScheduledAt,
      scheduledAt: instant,
      date,
      time: data.time,
    }) ?? parsedStatus;

  return {
    id,
    doctorId,
    patientId: data.patientId || 'unknown',
    patientName: data.patientName || 'Patient',
    patientEmail: data.patientEmail || '',
    type: normalizeType(data.type),
    status: displayStatus,
    date,
    time: normalizeAppointmentTime(data),
    scheduledAt: instant ?? undefined,
    notes: data.notes || '',
    documents: normalizeAppointmentDocuments(data.documents),
    postConsultActions: normalizePostConsultActions(data.postConsultActions),
    isManual: data.isManual ?? false,
    practiceId: data.practiceId || undefined,
    locationId: data.locationId || undefined,
    consultType: data.consultType || data.consultationType || undefined,
    teleconsult: normalizeTeleconsult(data.teleconsult),
    teleconsultConsent: data.teleconsultConsent
      ? {
          obtained: Boolean(data.teleconsultConsent.obtained),
          at: convertTimestamp(data.teleconsultConsent.at) || undefined,
          by: typeof data.teleconsultConsent.by === 'string' ? data.teleconsultConsent.by : undefined,
        }
      : undefined,
    virtualMeetingLink: typeof data.virtualMeetingLink === 'string' ? data.virtualMeetingLink : undefined,
    startAt: convertTimestamp(data.startAt) || undefined,
    endAt: convertTimestamp(data.endAt) || undefined,
    requestedByRole: data.requestedByRole || undefined,
    overrideApplied: data.overrideApplied ?? undefined,
    conflictMeta: data.conflictMeta || undefined,
    editScope,
    requiresConfirmation,
    confirmedScheduledAt,
    createdAt: convertTimestamp(data.createdAt) || date,
    updatedAt: convertTimestamp(data.updatedAt) || date,
  };
};

/**
 * Applies auto-cancellation rule to pending appointments whose date/time has passed
 * Updates Firestore for both global collection and doctor's subcollection
 */
const applyAutoCancellationToAppointment = async (
  appointmentId: string,
  doctorId: string,
  appointmentDate: Date,
  appointmentTime: string,
  currentStatus: Appointment['status'],
  patientId?: string,
  scheduledAt?: Date
): Promise<boolean> => {
  try {
    if (!canAutoCancelStatus(currentStatus)) {
      return false;
    }

    const appointmentDateTime =
      scheduledAt ??
      resolveScheduledAt({
        date: appointmentDate,
        time: appointmentTime,
        scheduledAt,
      }) ??
      appointmentDate;

    const now = new Date();
    if (appointmentDateTime > now) {
      return false;
    }

    const autoCancelPayload = {
      status: 'auto_cancelled' as const,
      updatedAt: serverTimestamp(),
      autoCancelledAt: serverTimestamp(),
    };

    const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    try {
      await setDoc(globalRef, autoCancelPayload, { merge: true });
    } catch (globalError) {
      console.warn(`[Global Collection] Could not update appointment ${appointmentId}:`, globalError);
    }

    const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
    try {
      await setDoc(doctorRef, autoCancelPayload, { merge: true });
    } catch (doctorError) {
      console.warn(`[Doctor Subcollection] Could not update appointment ${appointmentId}:`, doctorError);
    }

    if (patientId && !patientId.startsWith('manual_')) {
      const patientRef = doc(db, USERS_COLLECTION, patientId, 'appointments', appointmentId);
      try {
        await setDoc(patientRef, autoCancelPayload, { merge: true });
      } catch (patientError) {
        console.warn(`[Patient Subcollection] Could not update appointment ${appointmentId}:`, patientError);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error applying auto-cancellation to appointment ${appointmentId}:`, error);
    return false;
  }
};

/**
 * Processes a batch of appointments to apply auto-cancellation rules
 */
const applyAutoCancellationBatch = async (
  appointments: Appointment[],
  doctorId: string
): Promise<Appointment[]> => {
  console.log(`[Batch Processing] Starting auto-cancellation check for ${appointments.length} appointments`);
  
  const cancellationPromises = appointments.map((apt) =>
    applyAutoCancellationToAppointment(
      apt.id,
      doctorId,
      apt.date,
      apt.time,
      apt.status,
      apt.patientId,
      apt.scheduledAt
    )
  );

  const results = await Promise.allSettled(cancellationPromises);

  // Create updated appointments list with cancelled status where applicable
  const updatedAppointments = appointments.map((apt, index) => {
    const result = results[index];
    const wasUpdated = result?.status === 'fulfilled' && (result as PromiseFulfilledResult<boolean>).value === true;
    if (wasUpdated) {
      return { ...apt, status: 'auto_cancelled' as const };
    }
    return apt;
  });

  return updatedAppointments;
};

export const getDoctorAppointments = async (doctorId: string): Promise<Appointment[]> => {
  try {
    const appointments: Appointment[] = [];
    
    
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
          appointments.push(mapAppointmentFields(doc.id, data.doctorId || doctorId, data));
        } catch (error) {
          console.error('Error parsing global appointment:', error);
        }
      });
    } catch (error) {
    }

    try {
      const doctorAppointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
      const doctorSnapshot = await getDocs(doctorAppointmentsRef);
      doctorSnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          
          const exists = appointments.some(apt => apt.id === doc.id);
          if (!exists) {
            appointments.push(mapAppointmentFields(doc.id, doctorId, data));
          }
        } catch (error) {
          console.error('Error parsing doctor subcollection appointment:', error);
        }
      });
    } catch (error) {
    }

    // Apply auto-cancellation rule to pending appointments whose time has passed
    const appointmentsWithAutoCancellation = await applyAutoCancellationBatch(appointments, doctorId);

    const sorted = appointmentsWithAutoCancellation.sort((a, b) => b.date.getTime() - a.date.getTime());
    return sorted;
  } catch (error) {
    console.error('Error in getDoctorAppointments:', error);
    throw error;
  }
};

/**
 * Live view of a doctor's appointments.
 *
 * Watches both stores the platform writes to — the shared `appointments`
 * collection and the doctor's own copy — so a booking, cancellation or
 * reschedule made in the patient app shows up without a page refresh. The
 * shared record wins when both exist, matching `getDoctorAppointments`.
 */
export const listenToDoctorAppointments = (
  doctorId: string,
  onAppointmentsUpdate: (appointments: Appointment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  if (!doctorId || doctorId.trim() === '') {
    onError?.(new Error('Doctor ID is required'));
    return () => {};
  }

  const shared = new Map<string, Appointment>();
  const owned = new Map<string, Appointment>();
  const autoCancelChecked = new Set<string>();

  const emit = () => {
    const merged = new Map(owned);
    shared.forEach((apt, id) => merged.set(id, apt));
    const appointments = Array.from(merged.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );

    onAppointmentsUpdate(appointments);

    // Past pending visits are auto-cancelled once per session per appointment;
    // the resulting write flows back through these listeners.
    appointments
      .filter((apt) => canAutoCancelStatus(apt.status) && !autoCancelChecked.has(apt.id))
      .forEach((apt) => {
        autoCancelChecked.add(apt.id);
        void applyAutoCancellationToAppointment(
          apt.id,
          doctorId,
          apt.date,
          apt.time,
          apt.status,
          apt.patientId,
          apt.scheduledAt
        );
      });
  };

  const handleError = (error: Error) => {
    console.error('Error listening to doctor appointments:', error);
    onError?.(error);
  };

  const unsubscribeShared = onSnapshot(
    query(collection(db, APPOINTMENTS_COLLECTION), where('doctorId', '==', doctorId)),
    (snapshot) => {
      shared.clear();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        try {
          shared.set(docSnap.id, mapAppointmentFields(docSnap.id, data.doctorId || doctorId, data));
        } catch (error) {
          console.error('Error parsing shared appointment:', error);
        }
      });
      emit();
    },
    handleError
  );

  const unsubscribeOwned = onSnapshot(
    collection(db, USERS_COLLECTION, doctorId, 'appointments'),
    (snapshot) => {
      owned.clear();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        try {
          owned.set(docSnap.id, mapAppointmentFields(docSnap.id, doctorId, data));
        } catch (error) {
          console.error('Error parsing doctor appointment:', error);
        }
      });
      emit();
    },
    handleError
  );

  return () => {
    unsubscribeShared();
    unsubscribeOwned();
  };
};

/** All appointments for a clinic/practice (clinic admin schedule view). */
export const getPracticeWideAppointments = async (practiceId: string): Promise<Appointment[]> => {
  try {
    const ref = collection(
      db,
      PRACTICES_COLLECTION,
      practiceId,
      PRACTICE_APPOINTMENTS_SUBCOLLECTION
    );
    const snap = await getDocs(ref);
    const appointments = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      const doctorId =
        typeof data.doctorId === 'string' && data.doctorId.trim()
          ? data.doctorId
          : 'unknown';
      return mapAppointmentFields(docSnap.id, doctorId, data);
    });
    return appointments.sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (error) {
    console.error('Error in getPracticeWideAppointments:', error);
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
    const appointment: Appointment = mapAppointmentFields(appointmentDoc.id, doctorId, data);

    // Apply auto-cancellation rule if applicable
    const wasAutoCancelled = await applyAutoCancellationToAppointment(
      appointment.id,
      doctorId,
      appointment.date,
      appointment.time,
      appointment.status,
      appointment.patientId,
      appointment.scheduledAt
    );

    if (wasAutoCancelled) {
      appointment.status = 'auto_cancelled';
    }

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
    
    
    const globalAppointmentRef = collection(db, APPOINTMENTS_COLLECTION);
    const normalizedType = normalizeType(data.type);
    const consultType = data.consultType;
    // Dual-write consult fields so the patient app can detect video visits.
    const consultationType = consultType || (data as any).consultationType;
    const scheduledAt =
      data.scheduledAt ??
      data.startAt ??
      resolveScheduledAt({
        date: data.date,
        time: data.time,
        startAt: data.startAt,
        scheduledAt: data.scheduledAt,
      });
    const basePayload = {
      doctorId: data.doctorId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientEmail: data.patientEmail,
      type: normalizedType,
      status: data.requestedByRole === 'doctor' ? 'confirmed' : assertAppointmentStatus(data.status || 'pending'),
      date: Timestamp.fromDate(data.date),
      time: data.time,
      scheduledAt: scheduledAt ? Timestamp.fromDate(scheduledAt) : undefined,
      notes: data.notes || '',
      isManual: data.isManual ?? false,
      practiceId: data.practiceId,
      consultType,
      consultationType,
      locationId: data.locationId,
      startAt: data.startAt ? Timestamp.fromDate(data.startAt) : undefined,
      endAt: data.endAt ? Timestamp.fromDate(data.endAt) : undefined,
      requestedByRole: data.requestedByRole,
      overrideApplied: data.overrideApplied,
      conflictMeta: data.conflictMeta,
      durationMinutes: (data as any).durationMinutes,
      doctorName: (data as any).doctorName,
    };

    Object.keys(basePayload).forEach((key) => {
      if ((basePayload as any)[key] === undefined) {
        delete (basePayload as any)[key];
      }
    });

    const globalDocRef = await addDoc(globalAppointmentRef, {
      ...basePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const doctorAppointmentRef = doc(db, USERS_COLLECTION, data.doctorId, 'appointments', globalDocRef.id);
    await setDoc(doctorAppointmentRef, {
      ...basePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (data.patientId && !data.isManual) {
      const patientAppointmentRef = doc(db, USERS_COLLECTION, data.patientId, 'appointments', globalDocRef.id);
      await setDoc(patientAppointmentRef, {
        ...basePayload,
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

export const updateAppointment = async (
  doctorId: string,
  appointmentId: string,
  updates: Partial<Appointment>
): Promise<void> => {
  try {

    let appointmentData: any = null;
    let foundPatientId: string | undefined;

    const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
    const doctorSnap = await getDoc(doctorRef);
    if (doctorSnap.exists()) {
      appointmentData = doctorSnap.data();
      foundPatientId = appointmentData.patientId;
    }

    
    if (!appointmentData) {
      const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
      const globalSnap = await getDoc(globalRef);
      if (globalSnap.exists()) {
        appointmentData = globalSnap.data();
        foundPatientId = appointmentData.patientId;
      }
    }

    
    if (!appointmentData) {
      const globalQuery = query(
        collection(db, APPOINTMENTS_COLLECTION),
        where('doctorId', '==', doctorId)
      );
      const globalSnapshot = await getDocs(globalQuery);

      
      for (const doc of globalSnapshot.docs) {
        const data = doc.data();
        
        if (data.patientId === updates.patientId ||
            (updates.date && data.date?.toDate?.().toDateString() === updates.date.toDateString())) {
          appointmentData = data;
          foundPatientId = data.patientId;
          
          appointmentId = doc.id;
          break;
        }
      }
    }

    if (!appointmentData) {
      throw new Error(`Appointment ${appointmentId} not found in any collection for doctor ${doctorId}`);
    }

    
    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp(),
    };
    if (updates.status) {
      updateData.status = assertAppointmentStatus(updates.status);
    }
    if (updates.type) {
      updateData.type = normalizeType(updates.type);
    }
    if (updates.consultType) {
      updateData.consultType = updates.consultType;
      updateData.consultationType = updates.consultType;
    }
    if (updates.date) {
      updateData.date = Timestamp.fromDate(updates.date);
    }
    if (updates.date || updates.time || updates.scheduledAt || updates.startAt) {
      const instant =
        updates.scheduledAt ??
        updates.startAt ??
        resolveScheduledAt({
          date: updates.date ?? appointmentData.date,
          time: updates.time ?? appointmentData.time,
          scheduledAt: updates.scheduledAt ?? appointmentData.scheduledAt,
          startAt: updates.startAt ?? appointmentData.startAt,
        });
      if (instant) {
        updateData.scheduledAt = Timestamp.fromDate(instant);
      }
    }
    if (updates.teleconsultConsent) {
      updateData.teleconsultConsent = {
        ...updates.teleconsultConsent,
        at: updates.teleconsultConsent.at
          ? Timestamp.fromDate(
              updates.teleconsultConsent.at instanceof Date
                ? updates.teleconsultConsent.at
                : new Date(updates.teleconsultConsent.at)
            )
          : serverTimestamp(),
      };
    }
    delete updateData.id;
    delete updateData.doctorId;
    delete updateData.createdAt;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const isManualAppointment = Boolean(
      updates.isManual ?? appointmentData?.isManual ?? false
    );
    const canWritePatientSubcollection = Boolean(
      foundPatientId &&
        !isManualAppointment &&
        !String(foundPatientId).startsWith('manual_')
    );

    
    const updatePromises = [];

    
    const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    updatePromises.push(
      updateDoc(globalRef, updateData).catch(async (error) => {
        const fullData: any = {
          doctorId,
          ...appointmentData,
          ...updateData,
        };
        if (foundPatientId) {
          fullData.patientId = foundPatientId;
        }
        return setDoc(globalRef, fullData);
      })
    );

    
    const doctorAppointmentRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
    updatePromises.push(
      updateDoc(doctorAppointmentRef, updateData).catch(async (error) => {
        const fullData: any = {
          ...appointmentData,
          ...updateData,
        };
        if (foundPatientId) {
          fullData.patientId = foundPatientId;
        }
        return setDoc(doctorAppointmentRef, fullData);
      })
    );

    if (canWritePatientSubcollection && foundPatientId) {
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

    
    await Promise.all(updatePromises);

  } catch (error) {
    console.error('❌ Error updating appointment:', error);
    throw error;
  }
};
export const syncAppointmentStatus = async (appointmentId: string): Promise<void> => {
  try {

    
    const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    const globalSnap = await getDoc(globalRef);

    let masterData: any = null;

    if (globalSnap.exists()) {
      masterData = globalSnap.data();
    }

    
    if (!masterData) {
      
      
      return;
    }

    const doctorId = masterData.doctorId;
    const patientId = masterData.patientId;

    
    if (doctorId) {
      const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
      await setDoc(doctorRef, masterData, { merge: true });
    }

    
    if (patientId) {
      const patientRef = doc(db, USERS_COLLECTION, patientId, 'appointments', appointmentId);
      await setDoc(patientRef, masterData, { merge: true });
    }

  } catch (error) {
    console.error('Error syncing appointment:', error);
  }
};


export const syncAllDoctorAppointments = async (doctorId: string): Promise<void> => {
  try {

    
    const globalAppointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(globalAppointmentsRef, where('doctorId', '==', doctorId));
    const globalSnapshot = await getDocs(q);

    const syncPromises = globalSnapshot.docs.map(async (appointmentDoc) => {
      const appointmentId = appointmentDoc.id;
      const masterData = appointmentDoc.data();

      
      const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
      await setDoc(doctorRef, masterData, { merge: true });

      
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


export const diagnoseAppointmentSync = async (doctorId: string): Promise<{
  globalCount: number;
  doctorSubCount: number;
  inconsistencies: any[];
}> => {
  try {

    
    const globalAppointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const globalQuery = query(globalAppointmentsRef, where('doctorId', '==', doctorId));
    const globalSnapshot = await getDocs(globalQuery);
    const globalAppointments = globalSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    
    const doctorAppointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
    const doctorSnapshot = await getDocs(doctorAppointmentsRef);
    const doctorAppointments = doctorSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    const inconsistencies = [];

    
    for (const globalApt of globalAppointments) {
      const inDoctorSub = doctorAppointments.find(apt => apt.id === globalApt.id);
      if (!inDoctorSub) {
        inconsistencies.push({
          type: 'missing_in_doctor_sub',
          appointmentId: globalApt.id,
          globalData: globalApt
        });
      } else {
        
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


export const getMobileAppAppointments = async (doctorId: string): Promise<Appointment[]> => {
  try {
    
    
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
        appointments.push(mapAppointmentFields(doc.id, doctorId, data));
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

    try {
      const patientAppointmentsRef = collection(db, USERS_COLLECTION, patientId, 'appointments');
      const patientSnapshot = await getDocs(patientAppointmentsRef);
      patientSnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          appointments.push(mapAppointmentFields(doc.id, data.doctorId || 'unknown', data));
        } catch (error) {
        }
      });
    } catch (error) {
    }

    try {
      const globalAppointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
      const q = query(globalAppointmentsRef, where('patientId', '==', patientId));
      const globalSnapshot = await getDocs(q);
      globalSnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          
          const exists = appointments.some(apt => apt.id === doc.id);
          if (!exists) {
            appointments.push(mapAppointmentFields(doc.id, data.doctorId || 'unknown', data));
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

export const fixInconsistentAppointments = async (): Promise<void> => {
  try {

    const globalAppointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const globalSnapshot = await getDocs(globalAppointmentsRef);

    for (const globalDoc of globalSnapshot.docs) {
      const appointmentId = globalDoc.id;
      const globalData = globalDoc.data();
      const doctorId = globalData.doctorId;
      const patientId = globalData.patientId;

      if (doctorId) {
        const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
        const doctorSnap = await getDoc(doctorRef);

        if (doctorSnap.exists()) {
          const doctorData = doctorSnap.data();
          
          if (doctorData?.status !== globalData.status) {
            await setDoc(doctorRef, globalData, { merge: true });
          }
        } else {
          
          await setDoc(doctorRef, globalData);
        }
      }

      
      if (patientId) {
        const patientRef = doc(db, USERS_COLLECTION, patientId, 'appointments', appointmentId);
        const patientSnap = await getDoc(patientRef);

        if (patientSnap.exists()) {
          const patientData = patientSnap.data();
          
          if (patientData?.status !== globalData.status) {
            await setDoc(patientRef, globalData, { merge: true });
          }
        } else {
          
          await setDoc(patientRef, globalData);
        }
      }
    }

  } catch (error) {
    console.error('Error fixing inconsistent appointments:', error);
  }
};


export const autoSyncAppointments = async (): Promise<void> => {
  try {
    await fixInconsistentAppointments();
  } catch (error) {
    console.error('Auto-sync failed:', error);
  }
};


export const initializeAppointmentSync = (): void => {

  
  setTimeout(() => {
    autoSyncAppointments();
  }, 5000);

  
  setInterval(() => {
    autoSyncAppointments();
  }, 30 * 60 * 1000);

};


export const checkAppointmentConflict = async (
  doctorId: string,
  date: Date,
  time: string,
  excludeAppointmentId?: string
): Promise<boolean> => {
  try {

    
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('doctorId', '==', doctorId),
      where('date', '==', Timestamp.fromDate(date))
    );

    const snapshot = await getDocs(q);

    
    for (const doc of snapshot.docs) {
      const appointment = doc.data();

      
      if (excludeAppointmentId && doc.id === excludeAppointmentId) {
        continue;
      }

      
      if (appointment.time === time) {
        return true;
      }
    }

    
    try {
      const doctorAppointmentsRef = collection(db, USERS_COLLECTION, doctorId, 'appointments');
      const doctorQuery = query(
        doctorAppointmentsRef,
        where('date', '==', Timestamp.fromDate(date))
      );

      const doctorSnapshot = await getDocs(doctorQuery);

      for (const doc of doctorSnapshot.docs) {
        const appointment = doc.data();

        
        if (excludeAppointmentId && doc.id === excludeAppointmentId) {
          continue;
        }

        
        if (appointment.time === time) {
          return true;
        }
      }
    } catch (error) {
    }

    return false;
  } catch (error) {
    console.error('Error checking appointment conflict:', error);
    
    return false;
  }
};

export const addAppointmentDocument = async (
  doctorId: string,
  appointmentId: string,
  file: File,
  createdBy: string,
  title?: string
): Promise<AppointmentDocument> => {
  try {
    if (!file) throw new Error('Please select a document to upload.');
    if (file.size > 15 * 1024 * 1024) {
      throw new Error('File is too large. Maximum size is 15MB.');
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const documentId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `appointments/${doctorId}/${appointmentId}/documents/${documentId}-${safeName}`;
    const fileRef = storageRef(storage, path);

    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);

    const payload = {
      id: documentId,
      title: title?.trim() || null,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      downloadURL,
      storagePath: path,

      createdAt: Timestamp.fromDate(new Date()),
      createdBy,
    };

    const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    let patientId: string | undefined;

    const globalSnap = await getDoc(globalRef);
    if (globalSnap.exists()) {
      patientId = globalSnap.data()?.patientId;
    } else {
      const doctorSnap = await getDoc(doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId));
      if (doctorSnap.exists()) {
        patientId = doctorSnap.data()?.patientId;
      }
    }

    const writeTargets = [
      globalRef,
      doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId),
    ];

    if (patientId) {
      writeTargets.push(doc(db, USERS_COLLECTION, patientId, 'appointments', appointmentId));
    }

    await Promise.all(
      writeTargets.map((targetRef) =>
        updateDoc(targetRef, {
          documents: arrayUnion(payload),
          updatedAt: serverTimestamp(),
        }).catch(() =>
          setDoc(
            targetRef,
            {
              documents: arrayUnion(payload),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          )
        )
      )
    );

    return {
      id: documentId,
      title: title?.trim() || undefined,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      downloadURL,
      storagePath: path,
      createdAt: new Date(),
      createdBy,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload scanned document';
    throw new Error(message);
  }
};
