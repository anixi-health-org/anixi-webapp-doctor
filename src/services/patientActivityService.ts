export interface PatientActivityEntry {
  id: string;
  patientId: string;
  appointmentId: string | null;
  actionType: string;
  description: string;
  createdAt: Date | null;
}

type Unsubscribe = () => void;

interface LogPatientActivityInput {
  doctorId: string;
  patientId: string;
  appointmentId?: string;
  actionType: string;
  description: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export const logPatientActivity = async ({
  doctorId,
  patientId,
  appointmentId,
  actionType,
  description,
  metadata,
}: LogPatientActivityInput): Promise<void> => {
  if (!doctorId || !patientId || !actionType || !description) return;

  try {
    // TODO: persist via Django activity endpoint once available.
    console.log(
      `[patientActivityService] logPatientActivity stub — doctorId=${doctorId} patientId=${patientId} actionType=${actionType}`,
    );
  } catch (error) {
    console.warn('Failed to log patient activity', error);
  }
};

export const listenToRecentPatientActivity = (
  _doctorId: string,
  _entryLimit: number,
  onUpdate: (entries: PatientActivityEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  onUpdate([]);
  return () => {};
};
