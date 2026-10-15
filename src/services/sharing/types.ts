export type SharingRequestStatus = 'pending' | 'approved' | 'revoked';

/** Patient-side copy: Users/{patientUid}/sharing_requests/{id} */
export interface PatientSharingRequest {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorCity?: string;
  doctorYearsInPractice?: number;
  status: SharingRequestStatus;
  createdAt: Date;
  approvedAt?: Date;
}

/** Doctor inbox copy: Users/{doctorUid}/incoming_sharing_requests/{id} */
export interface IncomingSharingRequest {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  message?: string;
  status: SharingRequestStatus;
  createdAt: Date;
  approvedAt?: Date;
}

export interface DoctorSearchResult {
  id: string;
  displayName: string;
  email?: string;
  medicalSpecialty?: string;
  practiceCity?: string;
  yearsInPractice?: number;
  phoneNumber?: string;
  officeAddress?: string;
}
