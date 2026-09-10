

/**
 * Practice membership roles for multi-doctor clinics.
 * - owner: practice/clinic owner (billing + full control)
 * - practice_manager: day-to-day clinic admin
 * - doctor: clinician in the practice
 * - receptionist: booking & front-desk
 * - billing_clerk: invoices & claims prep
 * - delegate: legacy scheduling staff (kept for backward compatibility)
 */
export type PracticeRole =
    | 'owner'
    | 'practice_manager'
    | 'doctor'
    | 'nurse'
    | 'allied_health'
    | 'locum'
    | 'receptionist'
    | 'billing_clerk'
    | 'delegate';

export interface PracticePermissions {
    manageAppointments: boolean;
    manageSoftBlocks: boolean;
    overrideConflicts: boolean;
    editBookingPolicies: boolean;
    /** View/manage patients across the practice pool */
    managePatients: boolean;
    /** Invite/remove members and change roles */
    manageMembers: boolean;
    /** View all doctors' diaries and practice-wide calendar */
    viewAllDoctors: boolean;
    /** View practice revenue / invoice summaries */
    viewBilling: boolean;
}

export interface PracticeMember {
    uid: string;
    practiceId: string;
    role: PracticeRole;
    permissions: PracticePermissions;
    status: 'active' | 'inactive' | 'invited';
    displayName?: string;
    email?: string;
    /** True when this member is a clinician who can be booked */
    isClinician?: boolean;
    invitedBy?: string;
    invitedAt?: Date;
    /** Locum contracts, membership auto-expires after this date (client-enforced). */
    memberExpiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/** Solo private practice vs multi-doctor clinic/branch */
export type PracticeOrgType = 'solo' | 'clinic';

export interface PracticeLocation {
    id: string;
    name: string;
    address?: string;
    type: 'clinic' | 'hospital' | 'virtual' | 'other';
}

/** Physical or virtual room within a clinic location. */
export interface PracticeRoom {
    id: string;
    name: string;
    locationId?: string;
    type: 'consult' | 'procedure' | 'virtual' | 'other';
    capacity?: number;
    active?: boolean;
}

export type ConsultType =
    | 'initial'
    | 'follow-up'
    | 'urgent'
    | 'procedure'
    | 'teleconsult'
    | 'other';

/**
 * Per-type booking configuration on the Practice document.
 * bookableBlocks remain weekly time windows; these settings supply duration/buffer.
 */
export interface ConsultTypeSetting {
    /** Stable id, same as ConsultType for built-in types. */
    id: ConsultType;
    type: ConsultType;
    name: string;
    description: string;
    enabled: boolean;
    durationMinutes: number;
    bufferMinutes: number;
}

export interface Practice {
    id: string;
    name: string;
    timezone: string;
    ownerId: string;
    /** solo = private practitioner; clinic = multi-doctor establishment */
    orgType?: PracticeOrgType;
    /** Optional brand / trading name */
    tradingName?: string;
    /** BHF practice number at organisation level */
    bhfPracticeNumber?: string;
    locations: PracticeLocation[];
    /** Consult / procedure rooms for front-desk scheduling */
    rooms?: PracticeRoom[];
    /** Legacy enabled-type allow-list. Prefer consultTypeSettings when present. */
    consultTypes: ConsultType[];
    /** Authoritative appointment-type config (duration/buffer/enabled). Optional for legacy. */
    consultTypeSettings?: ConsultTypeSetting[];
    /** Patient-facing clinic listing (marketplace / browse) */
    publicListing?: PublicClinicListingSettings;
    createdAt: Date;
    updatedAt: Date;
}

export interface PublicClinicListingSettings {
    published: boolean;
    slug?: string;
    tagline?: string;
    description?: string;
    heroImageUrl?: string;
    city?: string;
    province?: string;
    services?: string[];
    acceptsMedicalAid?: boolean;
}

export interface PublicClinicListing {
    id: string;
    name: string;
    slug: string;
    tagline?: string;
    description?: string;
    city?: string;
    province?: string;
    services?: string[];
    acceptsMedicalAid?: boolean;
    heroImageUrl?: string;
    bhfPracticeNumber?: string;
}

export type ClinicAuditAction =
    | 'member.invited'
    | 'member.role_changed'
    | 'member.removed'
    | 'queue.arrival_updated'
    | 'queue.room_assigned'
    | 'settings.updated'
    | 'claim.submitted'
    | 'invoice.paid';

export interface ClinicAuditLogEntry {
    id: string;
    practiceId: string;
    action: ClinicAuditAction;
    actorUid: string;
    actorName?: string;
    targetType?: string;
    targetId?: string;
    summary: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

/** Wellness marketplace partner categories */
export type WellnessCategory =
    | 'nutrition'
    | 'fitness'
    | 'mental_health'
    | 'meal_plan'
    | 'home_care'
    | 'other';

export interface WellnessProvider {
    id: string;
    name: string;
    category: WellnessCategory;
    tagline?: string;
    description?: string;
    email?: string;
    phone?: string;
    city?: string;
    province?: string;
    services?: string[];
    published: boolean;
    verified?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface Pharmacy {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    province?: string;
    deliveryAvailable?: boolean;
    published: boolean;
    verified?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type PharmacyOrderStatus = 'sent' | 'acknowledged' | 'ready' | 'collected' | 'cancelled';

export interface PharmacyOrder {
    id: string;
    doctorId: string;
    patientId: string;
    appointmentId: string;
    postConsultActionId?: string;
    pharmacyId?: string;
    pharmacyEmail: string;
    pharmacyName: string;
    status: PharmacyOrderStatus;
    prescriptionText: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CopilotIcd10Suggestion {
    code: string;
    description: string;
    confidence: number;
}

export interface PreVisitSummary {
    patientId: string;
    headline: string;
    bullets: string[];
    medications: string[];
    lastVitals?: string;
    generatedAt: string;
}

export type EmployerMemberRole = 'owner' | 'hr_admin';

export interface EmployerOrg {
    id: string;
    name: string;
    industry?: string;
    city?: string;
    province?: string;
    ownerId: string;
    employeeTarget?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface EmployerMember {
    uid: string;
    employerId: string;
    role: EmployerMemberRole;
    email?: string;
    displayName?: string;
    status: 'active' | 'inactive';
    createdAt: Date;
}

export interface EmployeeEnrollment {
    id: string;
    employerId: string;
    email: string;
    displayName?: string;
    patientId?: string;
    status: 'invited' | 'active' | 'inactive';
    createdAt: Date;
    updatedAt: Date;
}

/** Pending invite stored under practices/{id}/invites/{inviteId} */
export type PracticeInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface PracticeInvite {
    id: string;
    practiceId: string;
    practiceName: string;
    email: string;
    displayName?: string;
    role: PracticeRole;
    permissions: PracticePermissions;
    invitedBy: string;
    invitedByName?: string;
    status: PracticeInviteStatus;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    acceptedAt?: Date;
    acceptedByUid?: string;
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
    role: 'doctor' | 'patient' | 'caregiver' | 'staff';
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
    /** Practice letterhead, invoices only */
    logoUrl?: string;
    /** Doctor headshot, header and patient-facing cards */
    profileImageUrl?: string;
    /** ISO 3166-1 alpha-2 - set at registration */
    country?: string;
    /** ISO 4217 - derived from country at registration */
    currency?: string;
    nationality?: string;
    /** Admin verification - set at registration; updated by Anixi Admin */
    verificationStatus?:
      | 'pending'
      | 'approved'
      | 'rejected'
      | 'suspended'
      | 'on_hold'
      | 'not_required';
    /** Clinic portal admin (not a practicing clinician) */
    accountKind?: 'clinic_admin' | 'clinician';
    /** When false, account is excluded from HPCSA / doctor verification */
    requiresClinicalVerification?: boolean;
    /** True once personal + practice details were submitted for review */
    applicationComplete?: boolean;
    applicationSubmittedAt?: Date;
    verifiedAt?: Date;
    rejectionReason?: string;
    practiceNumberBhf?: string;
    vatNumber?: string;
}
export type CaregiverTier = 'family' | 'professional';

export interface ProfessionalCaregiverProfile {
    organization?: string;
    services?: string[];
    bio?: string;
    city?: string;
    province?: string;
    /** Listed in patient marketplace when true */
    published?: boolean;
    verified?: boolean;
}

export interface Caregiver extends User {
    role: 'caregiver';
    phoneNumber?: string;
    caregiverTier?: CaregiverTier;
    professionalCaregiverProfile?: ProfessionalCaregiverProfile;
}
/** Clinic staff (receptionist, billing, practice manager) - portal access via practice membership */
export interface StaffUser extends User {
    role: 'staff';
    phoneNumber?: string;
    primaryPracticeId?: string;
    /** B2B employer wellness programme */
    primaryEmployerId?: string;
}
export type ProfessionalUser = Doctor | Caregiver | StaffUser;
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
    /** Practice/clinic this patient belongs to (shared pool) */
    practiceId?: string;
    /** Roster import status from clinic CSV upload */
    rosterStatus?: string;
    /** Code for patient to activate a pre-created clinic account in the app */
    activationCode?: string;
    /** From patient medical profile (mobile app), read-only for doctors */
    bloodGroup?: string;
    /** From patient medical profile (mobile app), read-only for doctors */
    weight?: string;
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
    status: 'confirmed' | 'pending' | 'rescheduled' | 'completed' | 'cancelled' | 'no_show' | 'auto_cancelled';
    date: Date;
    time: string;
    /** Canonical visit instant (UTC). Display strings are derived from this. */
    scheduledAt?: Date;
    /** Practice IANA timezone — calendar day and clock use this, not the browser TZ. */
    timezone?: string;
    /** Patient edit scope: moving the slot vs correcting visit type only. */
    editScope?: 'slot' | 'visit_type';
    /** When false, a patient edit does not need doctor re-confirmation. */
    requiresConfirmation?: boolean;
    /** Slot the doctor last confirmed; used to detect true reschedules. */
    confirmedScheduledAt?: Date;
    notes?: string;
    documents?: AppointmentDocument[];
    postConsultActions?: PostConsultAction[];
    
    isManual?: boolean;

    practiceId?: string;
    locationId?: string;
    consultType?: ConsultType;
    /** Snapshot of resolved type name at booking time (historical integrity). */
    appointmentTypeName?: string;
    /** Snapshot of buffer minutes resolved at booking time. */
    bufferMinutes?: number;
    teleconsult?: AppointmentTeleconsult;
    teleconsultConsent?: TeleconsultConsent;
    virtualMeetingLink?: string;
    startAt?: Date;
    endAt?: Date;
    /** Visit length in minutes when endAt is not stored. */
    durationMinutes?: number;
    requestedByRole?: 'patient' | 'doctor' | 'delegate' | 'caregiver';
    /** Front-desk arrival workflow */
    arrivalStatus?: 'expected' | 'checked_in' | 'with_doctor' | 'completed';
    checkedInAt?: Date;
    checkedInBy?: string;
    /** Assigned consult room (practice rooms[]) */
    roomId?: string;
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
    practiceId?: string;
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
    paymentProvider?: 'payfast' | 'ozow' | 'eft';
    paymentStatus?: 'pending' | 'completed' | 'failed';
    externalTransactionId?: string;
    paidViaGatewayAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type MedicalAidClaimStatus =
    | 'draft'
    | 'submitted'
    | 'accepted'
    | 'rejected'
    | 'paid';

export interface MedicalAidClaim {
    id: string;
    practiceId?: string;
    doctorId: string;
    patientId: string;
    invoiceId: string;
    invoiceNumber?: string;
    status: MedicalAidClaimStatus;
    medicalSchemeName?: string;
    memberNumber?: string;
    planOption?: string;
    diagnosisCodes?: string[];
    lineItems: InvoiceLineItem[];
    totalAmount: number;
    currency?: string;
    notes?: string;
    submittedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
