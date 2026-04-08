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
    date: string; // YYYY-MM-DD format
    mood?: MoodLog;
    adherence?: AdherenceLog[];
    vitals?: VitalsLog;
}

export type PatientStatus = 'stable' | 'warning' | 'inactive';

export interface Appointment {
    id: string;
    doctorId: string;
    patientId: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
    type: 'consultation' | 'follow-up' | 'emergency';
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export const getAppointmentUniqueKey = (patientId: string, appointmentId: string): string => {
    return `${patientId}:${appointmentId}`;
};

export interface DashboardStats {
    totalPatients: number;
    warningPatients: number;
    stablePatients: number;
    inactivePatients: number;
    upcomingAppointments: number;
}
