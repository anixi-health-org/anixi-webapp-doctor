import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDownTrayIcon, ArrowLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getPracticePatientAccount,
  updatePracticePatientAccount,
} from '../../services/practicePatientService';
import { listPracticeClinicians } from '../../services/practiceSettingsService';
import { sendPatientDownloadInvite } from '../../services/patientManagementService';
import { downloadPracticePatientRecordPDF } from '../../services/practicePatientRecordPdfService';
import type { DjangoPracticePatient } from '../../services/djangoApiService';
import { unichartsChartNameLabel } from '../../lib/patientDisplayName';
import type { PracticeMember } from '../../types';

const fieldClass =
  'mt-1 w-full rounded-xl border border-[#e1e7ef] bg-white px-3 py-2.5 text-sm text-[#344256] focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20';

const readOnlyClass =
  'mt-1 w-full rounded-xl border border-[#e1e7ef] bg-[#f8fafc] px-3 py-2.5 text-sm text-[#344256]';

function listToText(value?: string[] | null): string {
  if (!value?.length) return '';
  return value.join('\n');
}

function accountToDraft(row: DjangoPracticePatient) {
  return {
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
    chartId: row.chartId || '',
    mrn: row.mrn || '',
    unichartAge: row.unichartAge || '',
    race: row.race || '',
    homePhone: row.homePhone || '',
    workPhone: row.workPhone || '',
    contactStatus: row.contactStatus || '',
    institution: row.institution || '',
    medicalAidGroup: row.medicalAidGroup || '',
    planOption: row.planOption || '',
    insuredRelationship: row.insuredRelationship || '',
    medicalAidAuthNumber: row.medicalAidAuthNumber || '',
    guarantorName: row.guarantorName || '',
    guarantorPhone: row.guarantorPhone || '',
    guarantorRelationship: row.guarantorRelationship || '',
    guarantorRemarks: row.guarantorRemarks || '',
    address: row.address || '',
    pastMedicalHistoryText: row.pastMedicalHistoryText || '',
    familyHistoryText: row.familyHistoryText || '',
    socialHistoryText: row.socialHistoryText || '',
    masterProblemsList: listToText(row.masterProblemsList),
    activeProblems: listToText(row.activeProblems),
    language: row.language || '',
    maritalStatus: row.maritalStatus || '',
    occupation: row.occupation || '',
    employmentStatus: row.employmentStatus || '',
    bloodGroup: row.bloodGroup || '',
    weight: row.weight || '',
    allergies: listToText(row.allergies),
    previousHealthConditions: listToText(row.previousHealthConditions),
    previousSurgeries: listToText(row.previousSurgeries),
    previousMedications: listToText(row.previousMedications),
    preferredHospital: row.preferredHospital || '',
    hasCaregiver: row.hasCaregiver === true,
    caregiverEmail: row.caregiverEmail || '',
  };
}

const ProfileField: React.FC<{
  label: string;
  value: string;
  onChange?: (value: string) => void;
  multiline?: boolean;
  readOnly?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, multiline, readOnly, placeholder }) => (
  <label className="block text-xs font-medium text-[#65758b]">
    {label}
    {multiline ? (
      <textarea
        className={`${readOnly ? readOnlyClass : fieldClass} min-h-[88px] resize-y`}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ) : (
      <input
        className={readOnly ? readOnlyClass : fieldClass}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )}
  </label>
);

export const ClinicAdminPatientAccountPage: React.FC = () => {
  const { patientId = '' } = useParams();
  const navigate = useNavigate();
  const { user, practiceSession } = useAuth();
  const { can, isClinician } = usePermissions();
  const practice = practiceSession?.practice;
  const canManage = can('managePatients');

  const [account, setAccount] = useState<DjangoPracticePatient | null>(null);
  const [clinicians, setClinicians] = useState<PracticeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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
    chartId: '',
    mrn: '',
    unichartAge: '',
    race: '',
    homePhone: '',
    workPhone: '',
    contactStatus: '',
    institution: '',
    medicalAidGroup: '',
    planOption: '',
    insuredRelationship: '',
    medicalAidAuthNumber: '',
    guarantorName: '',
    guarantorPhone: '',
    guarantorRelationship: '',
    guarantorRemarks: '',
    address: '',
    pastMedicalHistoryText: '',
    familyHistoryText: '',
    socialHistoryText: '',
    masterProblemsList: '',
    activeProblems: '',
    language: '',
    maritalStatus: '',
    occupation: '',
    employmentStatus: '',
    bloodGroup: '',
    weight: '',
    allergies: '',
    previousHealthConditions: '',
    previousSurgeries: '',
    previousMedications: '',
    preferredHospital: '',
    hasCaregiver: false,
    caregiverEmail: '',
  });

  const userId = user?.id ?? '';
  const canEditPatient =
    canManage ||
    (isClinician &&
      Boolean(userId) &&
      (account?.assignedDoctorId === userId || draft.assignedDoctorId === userId));

  const fieldsReadOnly = !isEditing || !canEditPatient;

  useEffect(() => {
    if (!practice?.id || !patientId) return;
    let cancelled = false;
    setLoading(true);
    setIsEditing(false);
    Promise.all([
      getPracticePatientAccount(practice.id, patientId),
      listPracticeClinicians(practice.id),
    ])
      .then(([row, clinicianRows]) => {
        if (cancelled) return;
        setAccount(row);
        setClinicians(clinicianRows);
        setDraft(accountToDraft(row));
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
    if (!practice?.id || !canEditPatient || !isEditing) return;
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
        ...(canManage
          ? { assignedDoctorId: draft.assignedDoctorId, isActive: draft.isActive }
          : {}),
        chartId: draft.chartId.trim(),
        mrn: draft.mrn.trim(),
        unichartAge: draft.unichartAge.trim(),
        race: draft.race.trim(),
        homePhone: draft.homePhone.trim(),
        workPhone: draft.workPhone.trim(),
        contactStatus: draft.contactStatus.trim(),
        institution: draft.institution.trim(),
        medicalAidGroup: draft.medicalAidGroup.trim(),
        planOption: draft.planOption.trim(),
        insuredRelationship: draft.insuredRelationship.trim(),
        medicalAidAuthNumber: draft.medicalAidAuthNumber.trim(),
        guarantorName: draft.guarantorName.trim(),
        guarantorPhone: draft.guarantorPhone.trim(),
        guarantorRelationship: draft.guarantorRelationship.trim(),
        guarantorRemarks: draft.guarantorRemarks.trim(),
        address: draft.address.trim(),
        pastMedicalHistoryText: draft.pastMedicalHistoryText.trim(),
        familyHistoryText: draft.familyHistoryText.trim(),
        socialHistoryText: draft.socialHistoryText.trim(),
        masterProblemsList: draft.masterProblemsList.trim(),
        activeProblems: draft.activeProblems.trim(),
        language: draft.language.trim(),
        maritalStatus: draft.maritalStatus.trim(),
        occupation: draft.occupation.trim(),
        employmentStatus: draft.employmentStatus.trim(),
        bloodGroup: draft.bloodGroup.trim(),
        weight: draft.weight.trim(),
        allergies: draft.allergies.trim(),
        previousHealthConditions: draft.previousHealthConditions.trim(),
        previousSurgeries: draft.previousSurgeries.trim(),
        previousMedications: draft.previousMedications.trim(),
        preferredHospital: draft.preferredHospital.trim(),
        hasCaregiver: draft.hasCaregiver,
        caregiverEmail: draft.caregiverEmail.trim(),
      });
      setAccount(saved);
      setDraft(accountToDraft(saved));
      setSuccess('Patient account saved.');
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this patient.');
    } finally {
      setSaving(false);
    }
  };

  const buildPatientSnapshot = (): DjangoPracticePatient | null => {
    if (!account) return null;
    return {
      ...account,
      displayName: draft.displayName.trim() || account.displayName,
      email: draft.email.trim(),
      phoneNumber: draft.phoneNumber.trim() || account.phoneNumber,
      dateOfBirth: draft.dateOfBirth.trim() || account.dateOfBirth,
      gender: draft.gender.trim() || account.gender,
      idNumber: draft.idNumber.trim() || account.idNumber,
      medicalAidName: draft.medicalAidName.trim() || account.medicalAidName,
      medicalAidNumber: draft.medicalAidNumber.trim() || account.medicalAidNumber,
      emergencyContactName: draft.emergencyContactName.trim() || account.emergencyContactName,
      emergencyContactPhone: draft.emergencyContactPhone.trim() || account.emergencyContactPhone,
      assignedDoctorId: draft.assignedDoctorId || account.assignedDoctorId,
      isActive: draft.isActive,
    };
  };

  const downloadRecordPdf = async () => {
    const snapshot = buildPatientSnapshot();
    if (!snapshot || !practice) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      const assigned = clinicians.find((row) => row.uid === draft.assignedDoctorId);
      await downloadPracticePatientRecordPDF({
        patient: snapshot,
        practice: { name: practice.name, clinicCode: practice.clinicCode },
        assignedDoctorName: assigned?.displayName || assigned?.email,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the patient PDF.');
    } finally {
      setDownloadingPdf(false);
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

  const startEditing = () => {
    setError(null);
    setSuccess(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (account) {
      setDraft(accountToDraft(account));
    }
    setError(null);
    setIsEditing(false);
  };

  const setDraftField =
    <K extends keyof typeof draft>(key: K) =>
    (value: (typeof draft)[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
    };

  const encountersDisplay =
    account?.recentUnichartEncounters?.length
      ? account.recentUnichartEncounters
          .map((row) =>
            [row.date, row.type, row.number ? `#${row.number}` : ''].filter(Boolean).join(' · '),
          )
          .join('\n')
      : '';

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
        description={
          isEditing
            ? 'Edit mode — update fields and save when you are done.'
            : 'Patient roster and clinical record. Use Edit to make changes.'
        }
        actions={
          account ? (
            <div className="flex flex-wrap items-center gap-2">
              {canEditPatient && !isEditing ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-anixi-green px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  Edit patient
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void downloadRecordPdf()}
                disabled={downloadingPdf}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e1e7ef] bg-white px-4 text-sm font-semibold text-[#344256] shadow-sm transition hover:border-[#c5cdd8] disabled:opacity-60"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                {downloadingPdf ? 'Preparing PDF…' : 'Download PDF'}
              </button>
            </div>
          ) : null
        }
      />
      {account ? (
        <p className="mt-1 text-sm text-[#65758b]">
          {(() => {
            const chartLabel = unichartsChartNameLabel(
              account.displayName,
              account.unichartChartName,
            );
            if (!chartLabel) return null;
            return (
              <>
                UniCharts chart name:{' '}
                <span className="font-medium text-[#344256]">{chartLabel}</span>
                {' · '}
                Roster uses given name(s) then surname for easier search.
              </>
            );
          })()}
        </p>
      ) : null}

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
                  className={fieldsReadOnly ? readOnlyClass : fieldClass}
                  value={draft.displayName}
                  readOnly={fieldsReadOnly}
                  onChange={(e) => setDraft((current) => ({ ...current, displayName: e.target.value }))}
                  required={isEditing}
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Date of birth
                <input
                  type="date"
                  className={fieldsReadOnly ? readOnlyClass : fieldClass}
                  value={draft.dateOfBirth}
                  disabled={fieldsReadOnly}
                  onChange={(e) => setDraft((current) => ({ ...current, dateOfBirth: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Gender
                <select
                  className={fieldsReadOnly ? readOnlyClass : fieldClass}
                  value={draft.gender}
                  disabled={fieldsReadOnly}
                  onChange={(e) => setDraft((current) => ({ ...current, gender: e.target.value }))}
                >
                  <option value="">Not set</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                National ID / member ID
                <input
                  className={fieldsReadOnly ? readOnlyClass : fieldClass}
                  value={draft.idNumber}
                  readOnly={fieldsReadOnly}
                  onChange={(e) => setDraft((current) => ({ ...current, idNumber: e.target.value }))}
                />
              </label>
              <ProfileField
                label="UniCharts chart ID (S.S.N.)"
                value={draft.chartId}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('chartId')}
              />
              <ProfileField
                label="MRN"
                value={draft.mrn}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('mrn')}
              />
              <ProfileField
                label="Age (from chart)"
                value={draft.unichartAge}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('unichartAge')}
              />
              <ProfileField
                label="Race"
                value={draft.race}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('race')}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">Contact</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-[#65758b]">
                Email
                <input
                  type="email"
                  className={fieldsReadOnly ? readOnlyClass : fieldClass}
                  value={draft.email}
                  readOnly={fieldsReadOnly}
                  onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Cell / primary phone
                <input
                  className={fieldsReadOnly ? readOnlyClass : fieldClass}
                  value={draft.phoneNumber}
                  readOnly={fieldsReadOnly}
                  onChange={(e) => setDraft((current) => ({ ...current, phoneNumber: e.target.value }))}
                />
              </label>
              <ProfileField
                label="Home phone"
                value={draft.homePhone}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('homePhone')}
              />
              <ProfileField
                label="Work phone"
                value={draft.workPhone}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('workPhone')}
              />
              <ProfileField
                label="Contact status"
                value={draft.contactStatus}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('contactStatus')}
              />
              <ProfileField
                label="Institution"
                value={draft.institution}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('institution')}
              />
              <label className="text-xs font-medium text-[#65758b]">
                Emergency contact name
                <input
                  className={fieldsReadOnly ? readOnlyClass : fieldClass}
                  value={draft.emergencyContactName}
                  readOnly={fieldsReadOnly}
                  onChange={(e) => setDraft((current) => ({ ...current, emergencyContactName: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Emergency contact phone
                <input
                  className={fieldsReadOnly ? readOnlyClass : fieldClass}
                  value={draft.emergencyContactPhone}
                  readOnly={fieldsReadOnly}
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
                  className={fieldsReadOnly ? readOnlyClass : fieldClass}
                  value={draft.medicalAidName}
                  readOnly={fieldsReadOnly}
                  onChange={(e) => setDraft((current) => ({ ...current, medicalAidName: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Membership number
                <input
                  className={fieldsReadOnly ? readOnlyClass : fieldClass}
                  value={draft.medicalAidNumber}
                  readOnly={fieldsReadOnly}
                  onChange={(e) => setDraft((current) => ({ ...current, medicalAidNumber: e.target.value }))}
                />
              </label>
              <ProfileField
                label="Group number"
                value={draft.medicalAidGroup}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('medicalAidGroup')}
              />
              <ProfileField
                label="Plan option"
                value={draft.planOption}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('planOption')}
              />
              <ProfileField
                label="Relationship to insured"
                value={draft.insuredRelationship}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('insuredRelationship')}
              />
              <ProfileField
                label="Authorization number"
                value={draft.medicalAidAuthNumber}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('medicalAidAuthNumber')}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
              Guarantor (UniCharts)
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ProfileField
                label="Guarantor name"
                value={draft.guarantorName}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('guarantorName')}
              />
              <ProfileField
                label="Guarantor phone"
                value={draft.guarantorPhone}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('guarantorPhone')}
              />
              <ProfileField
                label="Relationship to guarantor"
                value={draft.guarantorRelationship}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('guarantorRelationship')}
              />
              <ProfileField
                label="Guarantor remarks"
                value={draft.guarantorRemarks}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('guarantorRemarks')}
                multiline
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
              Clinical record
            </p>
            <p className="mt-1 text-xs text-[#8FA0B6]">
              Imported UniCharts data can be corrected here. List fields accept one item per line.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ProfileField
                label="Address"
                value={draft.address}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('address')}
                multiline
              />
              <ProfileField
                label="Past medical history (narrative)"
                value={draft.pastMedicalHistoryText}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('pastMedicalHistoryText')}
                multiline
              />
              <ProfileField
                label="Family history"
                value={draft.familyHistoryText}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('familyHistoryText')}
                multiline
              />
              <ProfileField
                label="Social history"
                value={draft.socialHistoryText}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('socialHistoryText')}
                multiline
              />
              <ProfileField
                label="Master problems list"
                value={draft.masterProblemsList}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('masterProblemsList')}
                multiline
                placeholder="One problem per line"
              />
              <ProfileField
                label="Active problems"
                value={draft.activeProblems}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('activeProblems')}
                multiline
                placeholder="One problem per line"
              />
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-[#65758b]">Recent encounters</p>
                <p className={`${readOnlyClass} whitespace-pre-line`}>{encountersDisplay || '—'}</p>
                <p className="mt-1 text-[11px] text-[#8FA0B6]">Synced from imported encounters (not editable here).</p>
              </div>
              <ProfileField
                label="Language"
                value={draft.language}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('language')}
              />
              <ProfileField
                label="Marital status"
                value={draft.maritalStatus}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('maritalStatus')}
              />
              <ProfileField
                label="Occupation"
                value={draft.occupation}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('occupation')}
              />
              <ProfileField
                label="Employment status"
                value={draft.employmentStatus}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('employmentStatus')}
              />
              <ProfileField
                label="Blood group"
                value={draft.bloodGroup}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('bloodGroup')}
              />
              <ProfileField
                label="Weight"
                value={draft.weight}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('weight')}
                placeholder="e.g. 82 kg"
              />
              <ProfileField
                label="Allergies"
                value={draft.allergies}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('allergies')}
                multiline
                placeholder="One allergy per line"
              />
              <ProfileField
                label="Conditions"
                value={draft.previousHealthConditions}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('previousHealthConditions')}
                multiline
                placeholder="One condition per line"
              />
              <ProfileField
                label="Previous surgeries"
                value={draft.previousSurgeries}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('previousSurgeries')}
                multiline
              />
              <ProfileField
                label="Previous medications"
                value={draft.previousMedications}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('previousMedications')}
                multiline
              />
              <ProfileField
                label="Preferred hospital"
                value={draft.preferredHospital}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('preferredHospital')}
              />
              <label className="flex items-center gap-2 pt-6 text-sm text-[#344256]">
                <input
                  type="checkbox"
                  checked={draft.hasCaregiver}
                  disabled={fieldsReadOnly}
                  onChange={(e) => setDraftField('hasCaregiver')(e.target.checked)}
                />
                Has caregiver
              </label>
              <ProfileField
                label="Caregiver email"
                value={draft.caregiverEmail}
                readOnly={fieldsReadOnly}
                onChange={setDraftField('caregiverEmail')}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">Care team</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-[#65758b]">
                Assigned doctor
                <select
                  className={fieldsReadOnly || !canManage ? readOnlyClass : fieldClass}
                  value={draft.assignedDoctorId}
                  disabled={fieldsReadOnly || !canManage}
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
                  disabled={fieldsReadOnly || !canManage}
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

          {isEditing ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {canManage ? (
                <button
                  type="button"
                  disabled={inviting || !draft.email.trim()}
                  onClick={() => void resendInvite()}
                  className="rounded-full border border-[#e1e7ef] px-5 py-2.5 text-sm font-semibold text-[#344256] disabled:opacity-50"
                >
                  {inviting ? 'Sending…' : 'Email activation'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-[#65758b]"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </form>
      )}
    </PageShell>
  );
};

export default ClinicAdminPatientAccountPage;
