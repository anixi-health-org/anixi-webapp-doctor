import React from 'react';
import {
  AlertTriangle,
  Heart,
  Phone,
  Pill,
  Shield,
  User,
} from 'lucide-react';
import { Patient } from '../../types';

interface PatientDetailsPanelProps {
  patient: Patient | null;
}

const sectionTitleClass =
  'mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500';

export const PatientDetailsPanel: React.FC<PatientDetailsPanelProps> = ({ patient }) => {
  if (!patient) {
    return null;
  }

  const today = new Date();
  const birthDate = patient.dateOfBirth ? new Date(patient.dateOfBirth) : null;
  const age = birthDate
    ? Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : undefined;

  const infoItems = [
    age !== undefined ? { label: 'Age', value: `${age} years` } : null,
    patient.gender
      ? { label: 'Gender', value: patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) }
      : null,
    patient.maritalStatus
      ? {
          label: 'Marital status',
          value: patient.maritalStatus.charAt(0).toUpperCase() + patient.maritalStatus.slice(1),
        }
      : null,
    patient.phoneNumber ? { label: 'Phone', value: patient.phoneNumber } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      {infoItems.length > 0 && (
        <section className="mb-6">
          <h3 className={sectionTitleClass}>
            <User className="h-4 w-4" />
            Personal information
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            {infoItems.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3"
              >
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 break-words">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h3 className={sectionTitleClass}>
          <Heart className="h-4 w-4" />
          Medical information
        </h3>
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Chronic diseases
            </p>
            {patient.chronicDiseases && patient.chronicDiseases.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {patient.chronicDiseases.map((disease, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900"
                  >
                    {disease}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-amber-700/80">No chronic diseases recorded</p>
            )}
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">Allergies</p>
            {patient.allergies && patient.allergies.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {patient.allergies.map((allergy, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-900"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {allergy}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-rose-700/80">No allergies recorded</p>
            )}
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Current treatments
            </p>
            {patient.currentTreatments && patient.currentTreatments.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {patient.currentTreatments.map((treatment, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900"
                  >
                    <Pill className="h-3 w-3" />
                    {typeof treatment === 'string' ? treatment : treatment.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-emerald-700/80">No treatments recorded</p>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h3 className={sectionTitleClass}>
          <Phone className="h-4 w-4" />
          Emergency contact
        </h3>
        {patient.emergencyContact ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500">Name</p>
              <p className="text-sm font-medium text-gray-900">
                {patient.emergencyContact.name || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm font-medium text-gray-900">
                {patient.emergencyContact.phone || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Relationship</p>
              <p className="text-sm font-medium text-gray-900">
                {patient.emergencyContact.relationship || 'Not provided'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No emergency contact recorded</p>
        )}
      </section>

      {patient.medicalAid && (
        <section>
          <h3 className={sectionTitleClass}>
            <Shield className="h-4 w-4" />
            Medical aid
          </h3>
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500">Provider</p>
              <p className="text-sm font-medium text-gray-900">
                {patient.medicalAid.provider || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Member number</p>
              <p className="text-sm font-medium text-gray-900">
                {patient.medicalAid.memberNumber || 'Not provided'}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
