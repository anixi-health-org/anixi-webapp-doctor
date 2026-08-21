import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';
import { getDoctorAppointments } from './appointmentService';
import { getPatientsSharingRecords } from './medicalRecordShareService';

/**
 * Visit states that mean the patient and doctor are actually connected.
 * A pending request is not consent yet, so it must not create a roster entry.
 */
const CONNECTED_APPOINTMENT_STATUSES = new Set([
  'confirmed',
  'completed',
  'no_show',
]);

interface RosterCandidate {
  patientId: string;
  patientName: string;
  patientEmail?: string;
  source: 'appointment' | 'record_share';
}

/**
 * Adds patients the doctor demonstrably has to their roster.
 *
 * `approved_patients` is written by a Cloud Function when an appointment is
 * confirmed, but bookings that predate that trigger — or record shares, which
 * never touched it — leave the roster empty while the doctor plainly has
 * patients. Both sources here are patient-initiated, so nothing is granted
 * that the patient did not already agree to.
 */
export const syncDoctorPatientRoster = async (
  doctorId: string
): Promise<number> => {
  if (!doctorId) return 0;

  try {
    const [rosterSnapshot, appointments, shares] = await Promise.all([
      getDocs(collection(db, USERS_COLLECTION, doctorId, 'approved_patients')),
      getDoctorAppointments(doctorId),
      getPatientsSharingRecords(doctorId),
    ]);

    const onRoster = new Set(
      rosterSnapshot.docs.map((rosterDoc) => rosterDoc.data().patientId || rosterDoc.id)
    );

    const candidates = new Map<string, RosterCandidate>();

    appointments.forEach((appointment) => {
      const patientId = appointment.patientId;
      if (!patientId || patientId.startsWith('manual')) return;
      if (!CONNECTED_APPOINTMENT_STATUSES.has(appointment.status)) return;
      if (onRoster.has(patientId) || candidates.has(patientId)) return;

      candidates.set(patientId, {
        patientId,
        patientName: appointment.patientName || 'Patient',
        patientEmail: appointment.patientEmail || undefined,
        source: 'appointment',
      });
    });

    shares.forEach((grant) => {
      if (onRoster.has(grant.patientId) || candidates.has(grant.patientId)) return;
      candidates.set(grant.patientId, {
        patientId: grant.patientId,
        patientName: grant.patientName || 'Patient',
        source: 'record_share',
      });
    });

    if (candidates.size === 0) return 0;

    await Promise.all(
      Array.from(candidates.values()).map((candidate) =>
        setDoc(
          doc(
            db,
            USERS_COLLECTION,
            doctorId,
            'approved_patients',
            candidate.patientId
          ),
          {
            patientId: candidate.patientId,
            patientName: candidate.patientName,
            ...(candidate.patientEmail
              ? { patientEmail: candidate.patientEmail }
              : {}),
            status: 'active',
            dataAccessScope: 'all',
            source: candidate.source,
            approvedAt: serverTimestamp(),
          },
          { merge: true }
        )
      )
    );

    return candidates.size;
  } catch (error) {
    console.error('[patientRosterSync] syncDoctorPatientRoster', error);
    return 0;
  }
};
