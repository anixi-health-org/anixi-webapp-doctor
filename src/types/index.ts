

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



export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BookableBlock {
    id: string;
    practiceId: string;
    doctorId: string;
    dayOfWeek: DayOfWeek;
        startTime: string;
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
    interval: number;          
    endDate?: Date;
    daysOfWeek?: DayOfWeek[];  
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
    createdBy: string;         
    updatedBy: string;         
    createdAt: Date;
    updatedAt: Date;
}



export type ConfirmationMode = 'auto' | 'doctor_confirms';

export interface BookingPolicy {
    practiceId: string;
    patientCancellationWindowHours: number;   
    doctorCancellationWindowHours: number;    
    noShowPolicyText: string;
    confirmationMode: ConfirmationMode;
    updatedAt: Date;
}



export interface AvailableSlot {
    startAt: Date;
    endAt: Date;
    locationId: string;
    consultTypes: ConsultType[];
    bookableBlockId: string;
}



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
    practiceName?: string;
    logoUrl?: string;
    /** ISO 3166-1 alpha-2 — set at registration */
    country?: string;
    /** ISO 4217 — derived from country at registration */
    currency?: string;
    nationality?: string;
    /** Admin verification — set at registration; updated by Anixi Admin */
    verificationStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
    /** True once personal + practice details were submitted for review */
    applicationComplete?: boolean;
    applicationSubmittedAt?: Date;
    verifiedAt?: Date;
    rejectionReason?: string;
    practiceNumberBhf?: string;
    vatNumber?: string;
}
export interface Caregiver extends User {
    role: 'caregiver';
    phoneNumber?: string;
}
export type ProfessionalUser = Doctor | Caregiver;
export interface Patient extends User {
    role: 'patient';
    photoURL?: string;
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

export interface AppointmentDocument {
    id: string;
    title?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    downloadURL: string;
    storagePath: string;
    createdAt: Date;
    createdBy: string;
}

export type PostConsultActionType =
    | 'prescription_draft'
    | 'doctor_letter_draft'
    | 'medical_document'
    | 'session_recording'
    | 'post_consult_note';

export interface PostConsultAction {
    id: string;
    type: PostConsultActionType;
    title?: string;
    content: string;
    status: 'draft' | 'finalized';
    metadata?: Record<string, string | number | boolean | null>;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export type TeleconsultStatus = 'waiting' | 'in_progress' | 'ended';

export interface AppointmentTeleconsult {
    provider?: 'livekit';
    roomName?: string;
    status?: TeleconsultStatus | string;
    doctorJoinedAt?: Date;
    patientJoinedAt?: Date;
    endedAt?: Date;
    updatedAt?: Date;
}

export interface TeleconsultConsent {
    obtained: boolean;
    at?: Date;
    by?: string;
}

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
    documents?: AppointmentDocument[];
    postConsultActions?: PostConsultAction[];
    
    isManual?: boolean;

    practiceId?: string;
    locationId?: string;
    consultType?: ConsultType;
    teleconsult?: AppointmentTeleconsult;
    teleconsultConsent?: TeleconsultConsent;
    virtualMeetingLink?: string;
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



export interface PracticeSession {
    practice: Practice;
    member: PracticeMember;
    bookingPolicy: BookingPolicy;
}



export type AvailabilityStatus = 'open' | 'limited' | 'closed';

export interface PracticeDailySchedule {
    practiceId: string;
    date: string; 
    availability: AvailabilityStatus;
    openTime?: string; 
    closeTime?: string; 
    note?: string;
    updatedAt: Date;
}

export type InvoiceStatus = 'issued' | 'outstanding' | 'paid';

export interface InvoiceLineItem {
    description: string;
    quantity: number;
    amount: number; // unit amount ex-VAT
    icd10Code?: string;
    icd10Description?: string;
}

export interface Invoice {
    id: string;
    doctorId: string;
    patientId: string;
    appointmentId: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    lineItems: InvoiceLineItem[];
    subtotalExVat?: number;
    vatRate?: number; // default 0.15
    vatAmount?: number;
    totalAmount: number; // inclusive
    currency?: string;
    vatNumber?: string;
    bhfPracticeNumber?: string;
    hpcsaNumber?: string;
    paymentReference?: string; // EFT reference
    bankDetailsNote?: string;
    diagnosisCodes?: string[];
    issuedAt: Date;
    dueDate?: Date;
    paidAt?: Date;
    notes?: string;
    lastResentAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
