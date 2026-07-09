import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BeakerIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  IdentificationIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { PageHeader, PageShell } from '../components/page-layout';
import { EditPatientModal } from '../components/patients/EditPatientModal';
import { useAuth } from '../hooks/useAuth';
import { getDoctorPatients } from '../services/doctorService';
import { updatePatient, removePatientFromDoctor } from '../services/patientManagementService';
import { Patient } from '../types';
import {
  calculateAge,
  formatAddress,
  formatDate,
  formatEmail,
  formatGender,
  formatName,
  formatPhone,
  isEmpty,
} from '../utils/dataFormatter';

function InfoField({ label, value }: { label: string; value?: string | null }) {
  if (isEmpty(value)) {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1 text-sm text-gray-400">Not recorded</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-gray-200/80 shadow-sm">
      <CardHeader className="border-b border-gray-100 pb-4">
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Icon className="h-5 w-5 text-anixi-green" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

export const PatientFullDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.id || !patientId) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const patients = await getDoctorPatients(user.id);
        const found = patients.find((p) => p.id === patientId);
        if (!found) {
          setError('Patient not found in your practice.');
          return;
        }
        setPatient(found);
      } catch {
        setError('Failed to load patient record.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [user?.id, patientId]);

  const handleUpdate = async (updates: Partial<Patient>) => {
    if (!patient?.id) return;
    await updatePatient(patient.id, updates);
    setPatient({ ...patient, ...updates });
  };

  const handleRemove = async () => {
    if (!user?.id || !patient?.id) return;
    const confirmed = window.confirm(
      'Remove this patient from your practice? Manually created records may be deleted.'
    );
    if (!confirmed) return;
    setIsRemoving(true);
    setActionError(null);
    try {
      await removePatientFromDoctor(user.id, patient.id);
      navigate('/patients');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove patient');
    } finally {
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex min-h-[40vh] items-center justify-center text-gray-500">Loading record…</div>
      </PageShell>
    );
  }

  if (error || !patient) {
    return (
      <PageShell>
        <button
          type="button"
          onClick={() => navigate(`/patient-profile/${patientId}`)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-anixi-green"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to overview
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      </PageShell>
    );
  }

  const name = formatName(patient.displayName) || 'Patient';
  const age = calculateAge(patient.dateOfBirth);
  const allergies = (patient.allergies ?? []).filter((item) => !isEmpty(item));
  const conditions = (patient.chronicDiseases ?? []).filter((item) => !isEmpty(item));
  const treatments = (patient.currentTreatments ?? []).filter((t) => t.name && !isEmpty(t.name));
  const initials = name
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <PageShell>
      <button
        type="button"
        onClick={() => navigate(`/patient-profile/${patient.id}`)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-anixi-green"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to patient overview
      </button>

      <PageHeader
        title="Patient record"
        description={`Complete clinical and demographic profile for ${name}.`}
        actions={
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Edit record
          </button>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          {patient.photoURL ? (
            <img
              src={patient.photoURL}
              alt={name}
              className="h-24 w-24 rounded-2xl object-cover ring-2 ring-gray-100"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-anixi-green text-2xl font-bold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-2xl font-semibold text-gray-900">{name}</h2>
            <p className="mt-1 text-gray-500">
              {[age !== null ? `${age} years` : null, formatGender(patient.gender)]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-2 font-mono text-xs text-gray-400">ID {patient.id}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Personal information" icon={IdentificationIcon}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <InfoField label="Full name" value={name} />
            <InfoField
              label="Date of birth"
              value={
                patient.dateOfBirth ? formatDate(patient.dateOfBirth, 'long') ?? undefined : undefined
              }
            />
            <InfoField label="Gender" value={formatGender(patient.gender)} />
            <InfoField label="Marital status" value={patient.maritalStatus} />
            <InfoField label="Language" value={patient.language} />
            <InfoField
              label="Member since"
              value={patient.createdAt ? formatDate(patient.createdAt, 'short') ?? undefined : undefined}
            />
          </div>
        </SectionCard>

        <SectionCard title="Contact" icon={UserCircleIcon}>
          <div className="grid grid-cols-1 gap-5">
            <InfoField label="Email" value={formatEmail(patient.email)} />
            <InfoField label="Phone" value={formatPhone(patient.phoneNumber)} />
            <InfoField label="Address" value={formatAddress(patient.address)} />
            {patient.emergencyContact?.name ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Emergency contact
                </p>
                <p className="mt-1 font-medium text-gray-900">{patient.emergencyContact.name}</p>
                <p className="text-sm text-gray-600">
                  {[patient.emergencyContact.phone, patient.emergencyContact.relationship]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            ) : (
              <InfoField label="Emergency contact" />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Medical aid" icon={ShieldCheckIcon}>
          {patient.medicalAid?.provider || patient.medicalAid?.memberNumber ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <InfoField label="Provider" value={patient.medicalAid.provider} />
              <InfoField label="Member number" value={patient.medicalAid.memberNumber} />
              <InfoField label="Group number" value={patient.medicalAid.groupNumber} />
            </div>
          ) : (
            <p className="text-sm text-gray-500">No medical aid information on file.</p>
          )}
        </SectionCard>

        <SectionCard title="Allergies & conditions" icon={ExclamationTriangleIcon}>
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Allergies
              </p>
              {allergies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {allergies.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800 ring-1 ring-rose-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">None recorded</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Chronic conditions
              </p>
              {conditions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {conditions.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">None recorded</p>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Current treatments" icon={BeakerIcon}>
          {treatments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    <th className="pb-2 pr-4">Medication</th>
                    <th className="pb-2 pr-4">Dosage</th>
                    <th className="pb-2 pr-4">Frequency</th>
                    <th className="pb-2">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {treatments.map((treatment) => (
                    <tr key={`${treatment.name}-${treatment.startDate}`}>
                      <td className="py-3 pr-4 font-medium text-gray-900">{treatment.name}</td>
                      <td className="py-3 pr-4 text-gray-600">{treatment.dosage || '—'}</td>
                      <td className="py-3 pr-4 text-gray-600">{treatment.frequency || '—'}</td>
                      <td className="py-3 text-gray-600">
                        {treatment.startDate
                          ? formatDate(treatment.startDate, 'short') ?? '—'
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No active treatments recorded.</p>
          )}
        </SectionCard>

        <SectionCard title="Care quick links" icon={HeartIcon}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { label: 'Mood checker', path: 'mood-checker' },
              { label: 'Adherence calendar', path: 'adherence-calendar' },
              { label: 'Adherence logs', path: 'adherence-logs' },
              { label: 'Vitals history', path: 'vitals-history' },
            ].map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => navigate(`/patient-profile/${patient.id}/${link.path}`)}
                className="rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-800 transition-colors hover:border-anixi-green/30 hover:bg-anixi-green/5"
              >
                {link.label}
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <Card className="mt-6 border-red-200/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-800">
            <CalendarIcon className="h-5 w-5" />
            Practice management
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            Remove this patient from your practice if they are no longer under your care.
          </p>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            className="shrink-0 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {isRemoving ? 'Removing…' : 'Remove from practice'}
          </button>
        </CardContent>
      </Card>

      <EditPatientModal
        isOpen={showEditModal}
        patient={patient}
        onClose={() => setShowEditModal(false)}
        onSave={handleUpdate}
      />
    </PageShell>
  );
};

export default PatientFullDetailsPage;
