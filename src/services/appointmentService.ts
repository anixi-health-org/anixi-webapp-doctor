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
  type DocumentData,
  type QuerySnapshot,
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
  canAutoNoShowStatus,
  effectiveAppointmentStatus,
  formatAppointmentClock,
  hasConsultBeenStarted,
  parseAppointmentStatus,
  preferAppointmentStatus,
  resolveScheduledAt,
  shouldAutoMarkNoShow,
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
  const normalized = String(type).toLowerCase().replace(/_/g, '-').trim();
  const typeMap: { [key: string]: Appointment['type'] } = {
    'in-person': 'In-Person',
    inperson: 'In-Person',
    virtual: 'Virtual',
    teleconsult: 'Virtual',
    telehealth: 'Virtual',
    video: 'Virtual',
    phone: 'Phone',
    'follow-up': 'Follow-up',
    followup: 'Follow-up',
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

  const teleconsult = normalizeTeleconsult(data.teleconsult);
  const postConsultActions = normalizePostConsultActions(data.postConsultActions);
  const teleconsultConsent = data.teleconsultConsent
    ? {
        obtained: Boolean(data.teleconsultConsent.obtained),
        at: convertTimestamp(data.teleconsultConsent.at) || undefined,
        by: typeof data.teleconsultConsent.by === 'string' ? data.teleconsultConsent.by : undefined,
      }
    : undefined;

  // Auto no-show can race ahead of "mark completed" and leave a done visit as
  // Missed. If the consult clearly happened, surface Completed instead.
  let status = displayStatus;
  if (
    status === 'no_show' &&
    hasConsultBeenStarted({
      status,
      teleconsult,
      postConsultActions,
    })
  ) {
    status = 'completed';
  }

  return {
    id,
    doctorId,
    patientId: data.patientId || 'unknown',
    patientName: data.patientName || 'Patient',
    patientEmail: data.patientEmail || '',
    type: normalizeType(data.type),
    status,
    date,
    time: normalizeAppointmentTime(data),
    scheduledAt: instant ?? undefined,
    notes: data.notes || '',
    documents: normalizeAppointmentDocuments(data.documents),
    postConsultActions,
    isManual: data.isManual ?? false,
    practiceId: data.practiceId || undefined,
    locationId: data.locationId || undefined,
    consultType: data.consultType || data.consultationType || undefined,
    teleconsult,
    teleconsultConsent,
    virtualMeetingLink: typeof data.virtualMeetingLink === 'string' ? data.virtualMeetingLink : undefined,
    startAt: convertTimestamp(data.startAt) || undefined,
    endAt: convertTimestamp(data.endAt) || undefined,
    durationMinutes:
      typeof data.durationMinutes === 'number' &&
      Number.isFinite(data.durationMinutes) &&
      data.durationMinutes > 0
        ? data.durationMinutes
        : undefined,
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

    // Patient copy is updated by mirrorSharedAppointment when the global doc changes.

    return true;
  } catch (error) {
    console.error(`Error applying auto-cancellation to appointment ${appointmentId}:`, error);
    return false;
  }
};

/**
 * Marks a confirmed appointment as missed (no_show) once the booked slot has ended
 * and no consult was started. Mirrors mobile auto-close behaviour.
 *
 * Always re-reads Firestore before writing so a concurrent "mark completed"
 * cannot be overwritten by a stale in-memory confirmed status.
 */
const applyAutoNoShowToAppointment = async (
  appointment: Appointment,
  doctorId: string
): Promise<boolean> => {
  try {
    if (!shouldAutoMarkNoShow(appointment)) {
      return false;
    }
    if (!canAutoNoShowStatus(appointment.status)) {
      return false;
    }

    const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointment.id);
    const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointment.id);
    const [globalSnap, doctorSnap] = await Promise.all([getDoc(globalRef), getDoc(doctorRef)]);

    const liveStatuses = [globalSnap.data()?.status, doctorSnap.data()?.status]
      .map((value) => parseAppointmentStatus(value))
      .filter((value): value is NonNullable<typeof value> => value != null);

    if (liveStatuses.some((status) => status === 'completed' || status === 'cancelled' || status === 'auto_cancelled' || status === 'no_show')) {
      return false;
    }

    const liveTeleconsult = {
      ...(globalSnap.data()?.teleconsult ?? {}),
      ...(doctorSnap.data()?.teleconsult ?? {}),
    };
    const liveActions =
      doctorSnap.data()?.postConsultActions ?? globalSnap.data()?.postConsultActions;

    if (
      hasConsultBeenStarted({
        status: preferAppointmentStatus(
          doctorSnap.data()?.status,
          globalSnap.data()?.status
        ),
        teleconsult: {
          status: liveTeleconsult.status,
          doctorJoinedAt: convertTimestamp(liveTeleconsult.doctorJoinedAt),
          patientJoinedAt: convertTimestamp(liveTeleconsult.patientJoinedAt),
          roomName: liveTeleconsult.roomName,
          provider: liveTeleconsult.provider,
        },
        postConsultActions: Array.isArray(liveActions) ? liveActions : null,
      })
    ) {
      return false;
    }

    if (!canAutoNoShowStatus(preferAppointmentStatus(doctorSnap.data()?.status, globalSnap.data()?.status))) {
      return false;
    }

    const noShowPayload = {
      status: 'no_show' as const,
      updatedAt: serverTimestamp(),
      autoNoShowAt: serverTimestamp(),
    };

    try {
      await setDoc(globalRef, noShowPayload, { merge: true });
    } catch (globalError) {
      console.warn(`[Global Collection] Could not mark no-show ${appointment.id}:`, globalError);
    }

    try {
      await setDoc(doctorRef, noShowPayload, { merge: true });
    } catch (doctorError) {
      console.warn(`[Doctor Subcollection] Could not mark no-show ${appointment.id}:`, doctorError);
    }

    // Patient copy is mirrored from appointments/{id} by Cloud Function.
    // Doctors cannot write Users/{patientId}/** under security rules.

    return true;
  } catch (error) {
    console.error(`Error applying auto no-show to appointment ${appointment.id}:`, error);
    return false;
  }
};

/**
 * If auto no-show overwrote a visit that actually had a consult, restore Completed.
 */
const healMisfiredNoShow = async (
  appointment: Appointment,
  doctorId: string
): Promise<boolean> => {
  try {
    if (!hasConsultBeenStarted(appointment)) return false;

    const globalRef = doc(db, APPOINTMENTS_COLLECTION, appointment.id);
    const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointment.id);
    const [globalSnap, doctorSnap] = await Promise.all([getDoc(globalRef), getDoc(doctorRef)]);

    const liveStatus = preferAppointmentStatus(
      doctorSnap.data()?.status,
      globalSnap.data()?.status
    );
    if (liveStatus !== 'no_show') return false;

    const payload = {
      status: 'completed' as const,
      updatedAt: serverTimestamp(),
      healedFromNoShowAt: serverTimestamp(),
    };

    await Promise.all([
      setDoc(globalRef, payload, { merge: true }).catch(() => undefined),
      setDoc(doctorRef, payload, { merge: true }).catch(() => undefined),
    ]);

    // Patient copy is mirrored from appointments/{id} by Cloud Function.

    return true;
  } catch (error) {
    console.error(`Error healing no-show appointment ${appointment.id}:`, error);
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
  const afterAutoCancel = appointments.map((apt, index) => {
    const result = results[index];
    const wasUpdated = result?.status === 'fulfilled' && (result as PromiseFulfilledResult<boolean>).value === true;
    if (wasUpdated) {
      return { ...apt, status: 'auto_cancelled' as const };
    }
    return apt;
  });

  const noShowResults = await Promise.allSettled(
    afterAutoCancel.map((apt) => applyAutoNoShowToAppointment(apt, doctorId))
  );

  return afterAutoCancel.map((apt, index) => {
    const result = noShowResults[index];
    const wasUpdated =
      result?.status === 'fulfilled' &&
      (result as PromiseFulfilledResult<boolean>).value === true;
    if (wasUpdated) {
      return { ...apt, status: 'no_show' as const };
    }
    return apt;
  });
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
  const autoNoShowChecked = new Set<string>();
  const healChecked = new Set<string>();

  const emit = () => {
    const merged = new Map(owned);
    shared.forEach((sharedApt, id) => {
      const ownedApt = merged.get(id);
      if (!ownedApt) {
        merged.set(id, sharedApt);
        return;
      }
      const preferredStatus =
        preferAppointmentStatus(ownedApt.status, sharedApt.status) ?? sharedApt.status;
      const teleconsult = {
        ...(ownedApt.teleconsult ?? {}),
        ...(sharedApt.teleconsult ?? {}),
      };
      merged.set(id, {
        ...ownedApt,
        ...sharedApt,
        status: preferredStatus,
        teleconsult: Object.keys(teleconsult).length > 0 ? teleconsult : sharedApt.teleconsult,
        postConsultActions:
          (ownedApt.postConsultActions?.length ?? 0) >= (sharedApt.postConsultActions?.length ?? 0)
            ? ownedApt.postConsultActions
            : sharedApt.postConsultActions,
      });
    });
    const appointments = Array.from(merged.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );

    onAppointmentsUpdate(appointments);

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

    appointments
      .filter((apt) => shouldAutoMarkNoShow(apt) && !autoNoShowChecked.has(apt.id))
      .forEach((apt) => {
        autoNoShowChecked.add(apt.id);
        void applyAutoNoShowToAppointment(apt, doctorId);
      });

    appointments
      .filter((apt) => hasConsultBeenStarted(apt) && !healChecked.has(apt.id))
      .forEach((apt) => {
        healChecked.add(apt.id);
        void healMisfiredNoShow(apt, doctorId);
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
    const sharedRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    const [appointmentDoc, sharedDoc] = await Promise.all([
      getDoc(appointmentRef),
      getDoc(sharedRef),
    ]);

    if (!appointmentDoc.exists() && !sharedDoc.exists()) {
      return null;
    }

    // Prefer the doctor's copy for notes, but pull scheduling / teleconsult
    // fields from the shared record when the subcollection is stale.
    const doctorData = appointmentDoc.exists() ? appointmentDoc.data() : {};
    const sharedData = sharedDoc.exists() ? sharedDoc.data() : {};
    const mergedData: DocumentData = {
      ...sharedData,
      ...doctorData,
    };
    if (sharedDoc.exists()) {
      const shared = sharedData;
      if (shared.teleconsult) {
        mergedData.teleconsult = {
          ...(doctorData.teleconsult ?? {}),
          ...shared.teleconsult,
        };
      }
      const preferredStatus = preferAppointmentStatus(doctorData.status, shared.status);
      if (preferredStatus) {
        mergedData.status = preferredStatus;
      }
      const doctorActions = Array.isArray(doctorData.postConsultActions)
        ? doctorData.postConsultActions
        : [];
      const sharedActions = Array.isArray(shared.postConsultActions)
        ? shared.postConsultActions
        : [];
      if (sharedActions.length > doctorActions.length) {
        mergedData.postConsultActions = sharedActions;
      }
      if (!mergedData.consultType && shared.consultType) {
        mergedData.consultType = shared.consultType;
      }
      if (!mergedData.consultationType && shared.consultationType) {
        mergedData.consultationType = shared.consultationType;
      }
      if (shared.type && (!mergedData.type || mergedData.type === 'In-Person')) {
        const sharedType = String(shared.type).toLowerCase();
        if (
          sharedType === 'virtual' ||
          sharedType === 'teleconsult' ||
          sharedType === 'telehealth' ||
          sharedType === 'video'
        ) {
          mergedData.type = shared.type;
        }
      }
    }

    const appointment: Appointment = mapAppointmentFields(
      appointmentId,
      doctorId,
      mergedData
    );

    const healed = await healMisfiredNoShow(appointment, doctorId);
    if (healed) {
      appointment.status = 'completed';
      return appointment;
    }

    const teleconsultOpen =
      appointment.teleconsult?.status === 'in_progress' ||
      appointment.teleconsult?.status === 'waiting' ||
      Boolean(
        appointment.teleconsult?.doctorJoinedAt ||
          appointment.teleconsult?.patientJoinedAt
      );

    // Never auto-cancel / no-show a visit that still has an open video session.
    if (teleconsultOpen) {
      return appointment;
    }

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
      return appointment;
    }

    const wasAutoNoShow = await applyAutoNoShowToAppointment(appointment, doctorId);
    if (wasAutoNoShow) {
      appointment.status = 'no_show';
    }

    return appointment;
  } catch (error) {
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

    // Patient copy is created/updated by mirrorSharedAppointment from the global doc.
    // Do not client-write Users/{patientId}/appointments — rules deny it and can
    // fail the whole create after the shared/doctor docs already exist.
    
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

    if (doctorId) {
      const doctorRef = doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId);
      await setDoc(doctorRef, masterData, { merge: true });
    }

    // The patient's copy is mirrored by the `mirrorSharedAppointment` Cloud
    // Function. Security rules block a doctor from writing another user's
    // subcollection, so attempting it here fails silently and leaves the
    // patient looking at a stale status.
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

      // Patient copy is owned by mirrorSharedAppointment — never write it from the portal.

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

/**
 * Every visit this doctor has with one patient, newest first.
 *
 * Reads must stay inside what the doctor owns: `Users/{patientId}/appointments`
 * belongs to the patient and is denied outright, and querying the shared
 * collection by `patientId` alone would sweep in other doctors' visits and be
 * rejected. Scoping both queries to this doctor keeps them readable.
 */
export const getDoctorPatientAppointments = async (
  doctorId: string,
  patientId: string
): Promise<Appointment[]> => {
  if (!doctorId || !patientId) return [];

  const byId = new Map<string, Appointment>();

  const collect = (snapshot: QuerySnapshot<DocumentData>) => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.patientId !== patientId) return;
      if (byId.has(docSnap.id)) return;
      try {
        byId.set(
          docSnap.id,
          mapAppointmentFields(docSnap.id, data.doctorId || doctorId, data)
        );
      } catch {
        // Skip records we cannot map into the portal's shape.
      }
    });
  };

  try {
    collect(
      await getDocs(
        query(
          collection(db, USERS_COLLECTION, doctorId, 'appointments'),
          where('patientId', '==', patientId)
        )
      )
    );
  } catch (error) {
    console.error('[appointmentService] doctor-owned patient appointments', error);
  }

  try {
    collect(
      await getDocs(
        query(
          collection(db, APPOINTMENTS_COLLECTION),
          where('doctorId', '==', doctorId),
          where('patientId', '==', patientId)
        )
      )
    );
  } catch (error) {
    console.error('[appointmentService] shared patient appointments', error);
  }

  return Array.from(byId.values()).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
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

      // Patient copies are repaired by mirrorSharedAppointment on global writes.
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

    const writeTargets = [
      globalRef,
      doc(db, USERS_COLLECTION, doctorId, 'appointments', appointmentId),
    ];

    // Patient document list is mirrored when the global appointment updates.

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
