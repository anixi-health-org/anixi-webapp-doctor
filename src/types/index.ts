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
    status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
    date: Date;                   
    time: string;                 
    notes?: string;
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
