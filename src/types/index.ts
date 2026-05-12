// ─── Practice Roles & Permissions ────────────────────────────────────────────

export type PracticeRole = 'owner' | 'delegate';

export interface PracticePermissions {
    manageAppointments: boolean;
    manageSoftBlocks: boolean;
    overrideConflicts: boolean;
    editBookingPolicies: boolean;
}

export interface PracticeMember {
    uid: string;
    practiceId: string;
    role: PracticeRole;
    permissions: PracticePermissions;
    status: 'active' | 'inactive';
    displayName?: string;
    email?: string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Practice Context ─────────────────────────────────────────────────────────

export interface PracticeLocation {
    id: string;
    name: string;
    address?: string;
    type: 'clinic' | 'hospital' | 'virtual' | 'other';
}

export type ConsultType =
    | 'initial'
    | 'follow-up'
    | 'urgent'
    | 'procedure'
    | 'teleconsult'
    | 'other';

export interface Practice {
    id: string;
    name: string;
    timezone: string;
    ownerId: string;
    locations: PracticeLocation[];
    consultTypes: ConsultType[];
    createdAt: Date;
    updatedAt: Date;
}

// ─── Bookable Blocks ──────────────────────────────────────────────────────────

/** 0 = Sunday, 1 = Monday … 6 = Saturday */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BookableBlock {
    id: string;
    practiceId: string;
    doctorId: string;
    dayOfWeek: DayOfWeek;
    /** 24-h "HH:mm" */
    startTime: string;
    /** 24-h "HH:mm" */
    endTime: string;
    locationId: string;
    allowedConsultTypes: ConsultType[];
    slotDurationMinutes: number;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Soft Blocks ──────────────────────────────────────────────────────────────

export type SoftBlockCategory =
    | 'surgery'
    | 'hospital_rounds'
    | 'admin'
    | 'buffer'
    | 'on_call'
    | 'other';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface SoftBlockRecurrence {
    frequency: RecurrenceFrequency;
    interval: number;          // e.g. every 2 weeks → frequency=weekly, interval=2
    endDate?: Date;
    daysOfWeek?: DayOfWeek[];  // for weekly recurrence
}

export interface SoftBlock {
    id: string;
    practiceId: string;
    doctorId: string;
    title: string;
    category: SoftBlockCategory;
    startAt: Date;
    endAt: Date;
    recurrence?: SoftBlockRecurrence;
    createdBy: string;         // uid
    updatedBy: string;         // uid
    createdAt: Date;
    updatedAt: Date;
}

// ─── Booking Policies ─────────────────────────────────────────────────────────

export type ConfirmationMode = 'auto' | 'doctor_confirms';

export interface BookingPolicy {
    practiceId: string;
    patientCancellationWindowHours: number;   // default 24
    doctorCancellationWindowHours: number;    // default 1
    noShowPolicyText: string;
    confirmationMode: ConfirmationMode;
    updatedAt: Date;
}

// ─── Available Slot (patient-facing, derived) ─────────────────────────────────

export interface AvailableSlot {
    startAt: Date;
    endAt: Date;
    locationId: string;
    consultTypes: ConsultType[];
    bookableBlockId: string;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface User {
    id: string;
    email: string;
    displayName?: string;
    role: 'doctor' | 'patient' | 'caregiver';
    createdAt: Date;
    updatedAt: Date;
}
export interface Doctor extends User {
    role: 'doctor';
    specialty?: string;
    licenseNumber?: string;
    phoneNumber?: string;
    officeAddress?: string;
}
export interface Patient extends User {
    role: 'patient';
    dateOfBirth?: Date;
    gender?: 'male' | 'female' | 'other';
    maritalStatus?: string;
    language?: string;
    address?: string;
    phoneNumber?: string;
    assignedDoctorId?: string;
    emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
    };
    medicalAid?: {
        provider: string;
        memberNumber: string;
        groupNumber?: string;
    };
    chronicDiseases?: string[];
    allergies?: string[];
    currentTreatments?: {
        name: string;
        dosage: string;
        frequency: string;
        startDate: Date;
    }[];
}
export interface MoodLog {
    id: string;
    patientId: string;
    mood: 'terrible' | 'bad' | 'neutral' | 'good' | 'excellent';
    notes?: string;
    timestamp: Date;
}
export interface AdherenceLog {
    id: string;
    patientId: string;
    medicationName: string;
    taken: boolean;
    timestamp: Date;
    notes?: string;
}
export interface VitalsLog {
    id: string;
    patientId: string;
    heartRate?: number;
    bloodPressure?: {
        systolic: number;
        diastolic: number;
    };
    temperature?: number;
    bloodSugar?: number;
    notes?: string;
    timestamp: Date;
}
export interface DailyLog {
    date: string; 
    mood?: MoodLog;
    adherence?: AdherenceLog[];
    vitals?: VitalsLog;
}
export type PatientStatus = 'stable' | 'warning' | 'inactive';
export interface Appointment {
    id: string;
    doctorId: string;
    patientId: string;
    patientName: string;
    patientEmail: string;
    type: 'In-Person' | 'Virtual' | 'Phone' | 'Follow-up';
    status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'no_show';
    date: Date;
    time: string;
    notes?: string;
    /** true = manually booked (free-text name, no Anixi account) */
    isManual?: boolean;
    // Practice scheduling extensions
    practiceId?: string;
    locationId?: string;
    consultType?: ConsultType;
    startAt?: Date;
    endAt?: Date;
    requestedByRole?: 'patient' | 'doctor' | 'delegate';
    overrideApplied?: boolean;
    conflictMeta?: { softBlockId?: string; appointmentId?: string; reason?: string };
    createdAt: Date;
    updatedAt: Date;
}
export const getAppointmentUniqueKey = (patientId: string, appointmentId: string): string => {
    return `${patientId}:${appointmentId}`;
};
export interface SharingRequest {
    id: string;
    patientId: string;
    doctorId: string;
    doctorInfo?: {
        id: string;
        displayName: string;
        email: string;
        specialty?: string;
    };
    patientInfo?: Patient;
    requestedDataTypes: ('vitals' | 'appointments' | 'mood' | 'adherence' | 'all')[];
    status: 'pending' | 'accepted' | 'rejected';
    reason?: string;
    createdAt: Date;
    respondedAt?: Date;
}

export interface DashboardStats {
    totalPatients: number;
    warningPatients: number;
    stablePatients: number;
    inactivePatients: number;
    upcomingAppointments: number;
}

// ─── Practice Session (loaded at login alongside Doctor profile) ───────────────

export interface PracticeSession {
    practice: Practice;
    member: PracticeMember;
    bookingPolicy: BookingPolicy;
}

// ─── Practice Daily Schedule ───────────────────────────────────────────────────

export type AvailabilityStatus = 'open' | 'limited' | 'closed';

export interface PracticeDailySchedule {
    practiceId: string;
    date: string; // YYYY-MM-DD
    availability: AvailabilityStatus;
    openTime?: string; // HH:mm
    closeTime?: string; // HH:mm
    note?: string;
    updatedAt: Date;
}
