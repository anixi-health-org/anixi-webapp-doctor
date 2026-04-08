
export const convertTimestamp = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  
  if (timestamp instanceof Date) return timestamp;
  
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  if (timestamp.seconds !== undefined && typeof timestamp.seconds === 'number') {
    return new Date(timestamp.seconds * 1000);
  }
  
  return null;
};

export const formatTimestamp = (
  timestamp: any,
  format: 'short' | 'long' | 'time' | 'datetime' = 'short'
): string => {
  const date = convertTimestamp(timestamp);
  if (!date) return '';

  if (format === 'time') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions);
  }

  if (format === 'datetime') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions);
  }

  if (format === 'long') {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } as Intl.DateTimeFormatOptions);
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' } as Intl.DateTimeFormatOptions);
};

export const formatTime = (timestamp: any): string => {
  const date = convertTimestamp(timestamp);
  if (!date) return '';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export const getDateString = (date: Date = new Date()): string => {
  return date.toISOString().split('T')[0];
};


export const getTimeSlot = (timestamp: any): 'morning' | 'afternoon' | 'evening' => {
  const date = convertTimestamp(timestamp);
  if (!date) return 'afternoon';
  
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

export const transformPatientData = (patient: any) => {
  if (!patient) return null;

  return {
    ...patient,
    dateOfBirth: convertTimestamp(patient.dateOfBirth),
    createdAt: convertTimestamp(patient.createdAt),
    updatedAt: convertTimestamp(patient.updatedAt),
    currentTreatments: (patient.currentTreatments || []).map((treatment: any) => ({
      ...treatment,
      startDate: convertTimestamp(treatment.startDate),
    })),
  };
};


export const transformMoodEntry = (entry: any) => {
  if (!entry) return null;

  return {
    ...entry,
    timestamp: convertTimestamp(entry.timestamp),
    createdAt: convertTimestamp(entry.createdAt),
  };
};


export const transformAdherenceRecord = (record: any) => {
  if (!record) return null;

  return {
    ...record,
    timestamp: convertTimestamp(record.timestamp),
    scheduledTime: convertTimestamp(record.scheduledTime),
    takenTime: convertTimestamp(record.takenTime),
    createdAt: convertTimestamp(record.createdAt),
    medications: (record.medications || []).map((med: any) => ({
      ...med,
      takenTime: convertTimestamp(med.takenTime),
    })),
  };
};


export const transformVitalsRecord = (record: any) => {
  if (!record) return null;

  return {
    ...record,
    timestamp: convertTimestamp(record.timestamp),
    recordedAt: convertTimestamp(record.recordedAt),
  };
};
