import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getPracticePatientAccount,
  updatePracticePatientAccount,
} from '../../services/practicePatientService';
import { listPracticeClinicians } from '../../services/practiceSettingsService';
import { sendPatientDownloadInvite } from '../../services/patientManagementService';
import type { DjangoPracticePatient } from '../../services/djangoApiService';
import type { PracticeMember } from '../../types';

const fieldClass =
  'mt-1 w-full rounded-xl border border-[#e1e7ef] bg-white px-3 py-2.5 text-sm text-[#344256] focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20';

const readOnlyClass =
  'mt-1 w-full rounded-xl border border-[#e1e7ef] bg-[#f8fafc] px-3 py-2.5 text-sm text-[#344256]';

function formatList(value?: string[] | string | null): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return (value || '').trim();
}

const ReadOnlyField: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium text-[#65758b]">{label}</p>
    <p className={readOnlyClass}>{value?.trim() || '—'}</p>
  </div>
);

export const ClinicAdminPatientAccountPage: React.FC = () => {
  const { patientId = '' } = useParams();
  const navigate = useNavigate();
  const { user, practiceSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const canManage = can('managePatients');

  const [account, setAccount] = useState<DjangoPracticePatient | null>(null);
  const [clinicians, setClinicians] = useState<PracticeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    displayName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    idNumber: '',
    medicalAidName: '',
    medicalAidNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    assignedDoctorId: '',
    isActive: true,
  });

  useEffect(() => {
    if (!practice?.id || !patientId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getPracticePatientAccount(practice.id, patientId),
      listPracticeClinicians(practice.id),
    ])
      .then(([row, clinicianRows]) => {
        if (cancelled) return;
        setAccount(row);
        setClinicians(clinicianRows);
        setDraft({
          displayName: row.displayName || '',
          email: row.email || '',
          phoneNumber: row.phoneNumber || '',
          dateOfBirth: row.dateOfBirth || '',
          gender: (row.gender || '').toLowerCase(),
          idNumber: row.idNumber || '',
          medicalAidName: row.medicalAidName || '',
          medicalAidNumber: row.medicalAidNumber || '',
          emergencyContactName: row.emergencyContactName || '',
          emergencyContactPhone: row.emergencyContactPhone || '',
          assignedDoctorId: row.assignedDoctorId || '',
          isActive: row.isActive !== false,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this patient.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [practice?.id, patientId]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!practice?.id || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await updatePracticePatientAccount(practice.id, patientId, {
        displayName: draft.displayName.trim(),
        email: draft.email.trim(),
        phoneNumber: draft.phoneNumber.trim(),
        dateOfBirth: draft.dateOfBirth.trim(),
        gender: draft.gender.trim(),
        idNumber: draft.idNumber.trim(),
        medicalAidName: draft.medicalAidName.trim(),
        medicalAidNumber: draft.medicalAidNumber.trim(),
        emergencyContactName: draft.emergencyContactName.trim(),
        emergencyContactPhone: draft.emergencyContactPhone.trim(),
        assignedDoctorId: draft.assignedDoctorId,
        isActive: draft.isActive,
      });
      setAccount(saved);
      setSuccess('Patient account saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this patient.');
    } finally {
      setSaving(false);
    }
  };

  const resendInvite = async () => {
    const to = draft.email.trim();
    if (!to || !practice) return;
    setInviting(true);
    setError(null);
    try {
      await sendPatientDownloadInvite({
        doctorId: user?.id || practice.ownerId,
        to,
        patientDisplayName: draft.displayName.trim() || 'Patient',
        clinicName: practice.name,
        clinicCode: practice.clinicCode,
        invitedByName: user?.displayName || 'Clinic admin',
      });
      setSuccess('Activation instructions were emailed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the invite.');
    } finally {
      setInviting(false);
    }
  };

  if (!practice) return null;

  const caregiverValue = account?.hasCaregiver
    ? ['Yes', account.caregiverEmail].filter(Boolean).join(' · ')
    : account?.caregiverEmail || '';

  return (
    <PageShell className="py-6 sm:py-8">
      <button
        type="button"
        onClick={() => navigate('/clinic/patients')}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e1e7ef] bg-white px-3.5 text-sm font-medium text-[#344256] shadow-sm transition hover:border-[#c5cdd8] hover:text-[#0E2340]"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to roster
      </button>
      <PageHeader
        className="mt-3"
        title={account?.displayName || 'Patient account'}
        description="Update roster details, assignment, and account status for this patient."
      />

      {loading ? (
        <p className="mt-6 text-sm text-[#65758b]">Loading patient account...</p>
      ) : (
        <form onSubmit={(event) => void save(event)} className="mt-6 space-y-6">
          {error ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}
          {success ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </p>
          ) : null}

          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">Identity</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-[#65758b]">
                Full name
                <input
                  className={fieldClass}
                  value={draft.displayName}
                  onChange={(e) => setDraft((current) => ({ ...current, displayName: e.target.value }))}
                  required
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Date of birth
                <input
                  type="date"
                  className={fieldClass}
                  value={draft.dateOfBirth}
                  onChange={(e) => setDraft((current) => ({ ...current, dateOfBirth: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Gender
                <select
                  className={fieldClass}
                  value={draft.gender}
                  onChange={(e) => setDraft((current) => ({ ...current, gender: e.target.value }))}
                >
                  <option value="">Not set</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                ID / MRN / chart ID
                <input
                  className={fieldClass}
                  value={draft.idNumber}
                  onChange={(e) => setDraft((current) => ({ ...current, idNumber: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">Contact</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-[#65758b]">
                Email
                <input
                  type="email"
                  className={fieldClass}
                  value={draft.email}
                  onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Phone
                <input
                  className={fieldClass}
                  value={draft.phoneNumber}
                  onChange={(e) => setDraft((current) => ({ ...current, phoneNumber: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Emergency contact name
                <input
                  className={fieldClass}
                  value={draft.emergencyContactName}
                  onChange={(e) => setDraft((current) => ({ ...current, emergencyContactName: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Emergency contact phone
                <input
                  className={fieldClass}
                  value={draft.emergencyContactPhone}
                  onChange={(e) => setDraft((current) => ({ ...current, emergencyContactPhone: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">Medical aid</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-[#65758b]">
                Scheme
                <input
                  className={fieldClass}
                  value={draft.medicalAidName}
                  onChange={(e) => setDraft((current) => ({ ...current, medicalAidName: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Membership number
                <input
                  className={fieldClass}
                  value={draft.medicalAidNumber}
                  onChange={(e) => setDraft((current) => ({ ...current, medicalAidNumber: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
                Patient app record
              </p>
              <p className="text-xs text-[#8FA0B6]">Read-only · updated by the patient in the app</p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Address" value={account?.address} />
              <ReadOnlyField label="Language" value={account?.language} />
              <ReadOnlyField label="Marital status" value={account?.maritalStatus} />
              <ReadOnlyField label="Occupation" value={account?.occupation} />
              <ReadOnlyField label="Employment status" value={account?.employmentStatus} />
              <ReadOnlyField label="Blood group" value={account?.bloodGroup} />
              <ReadOnlyField
                label="Weight"
                value={
                  account?.weight
                    ? /kg|lb/i.test(account.weight)
                      ? account.weight
                      : `${account.weight} kg`
                    : ''
                }
              />
              <ReadOnlyField label="Allergies" value={formatList(account?.allergies)} />
              <ReadOnlyField
                label="Conditions"
                value={formatList(account?.previousHealthConditions)}
              />
              <ReadOnlyField label="Previous surgeries" value={formatList(account?.previousSurgeries)} />
              <ReadOnlyField
                label="Previous medications"
                value={formatList(account?.previousMedications)}
              />
              <ReadOnlyField label="Preferred hospital" value={account?.preferredHospital} />
              <ReadOnlyField label="Plan option" value={account?.planOption} />
              <ReadOnlyField label="Caregiver" value={caregiverValue} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">Care team</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-[#65758b]">
                Assigned doctor
                <select
                  className={fieldClass}
                  value={draft.assignedDoctorId}
                  onChange={(e) => setDraft((current) => ({ ...current, assignedDoctorId: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {clinicians.map((clinician) => (
                    <option key={clinician.uid} value={clinician.uid}>
                      {clinician.displayName || clinician.email || clinician.uid}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm text-[#344256]">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft((current) => ({ ...current, isActive: e.target.checked }))}
                />
                Account can sign in
              </label>
            </div>
            <p className="mt-3 text-sm text-[#65758b]">
              Status: {account?.status === 'active' ? 'Activated' : 'Pending activation'}
              {practice.clinicCode ? ` · Clinic code ${practice.clinicCode}` : ''}
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || !canManage}
              className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save patient'}
            </button>
            <button
              type="button"
              disabled={inviting || !draft.email.trim()}
              onClick={() => void resendInvite()}
              className="rounded-full border border-[#e1e7ef] px-5 py-2.5 text-sm font-semibold text-[#344256] disabled:opacity-50"
            >
              {inviting ? 'Sending…' : 'Email activation'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/clinic/patients')}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-[#65758b]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </PageShell>
  );
};

export default ClinicAdminPatientAccountPage;
