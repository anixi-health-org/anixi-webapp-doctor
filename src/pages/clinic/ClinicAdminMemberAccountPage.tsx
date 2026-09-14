import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { INVITABLE_ROLES, ROLE_LABELS, permissionsForRole } from '../../lib/practiceRoles';
import {
  djangoDeactivatePracticeMember,
  djangoGetPracticeMemberAccount,
  djangoPatchPracticeMember,
} from '../../services/djangoApiService';
import type { PracticeRole } from '../../types';

const fieldClass =
  'mt-1 w-full rounded-xl border border-[#e1e7ef] bg-white px-3 py-2.5 text-sm text-[#344256] focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20';

type MemberAccount = {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  role: PracticeRole;
  isClinician: boolean;
  status: string;
  isActive: boolean;
  assignedPatientCount: number;
  profile: {
    title: string;
    specialty: string;
    licenseNumber: string;
    hpcsaRegistrationNumber: string;
    yearsOfExperience: string;
    gender: string;
    verificationStatus: string;
  };
};

const emptyAccount = (): MemberAccount => ({
  uid: '',
  displayName: '',
  email: '',
  phoneNumber: '',
  role: 'doctor',
  isClinician: true,
  status: 'active',
  isActive: true,
  assignedPatientCount: 0,
  profile: {
    title: '',
    specialty: '',
    licenseNumber: '',
    hpcsaRegistrationNumber: '',
    yearsOfExperience: '',
    gender: '',
    verificationStatus: '',
  },
});

function mapAccount(raw: Record<string, unknown>): MemberAccount {
  const profile = (raw.profile && typeof raw.profile === 'object' ? raw.profile : {}) as Record<
    string,
    unknown
  >;
  return {
    uid: String(raw.uid || ''),
    displayName: String(raw.displayName || ''),
    email: String(raw.email || ''),
    phoneNumber: String(raw.phoneNumber || ''),
    role: (raw.role as PracticeRole) || 'doctor',
    isClinician: Boolean(raw.isClinician),
    status: String(raw.status || 'active'),
    isActive: raw.isActive !== false,
    assignedPatientCount: Number(raw.assignedPatientCount || 0),
    profile: {
      title: String(profile.title || ''),
      specialty: String(profile.specialty || profile.medicalSpecialty || ''),
      licenseNumber: String(profile.licenseNumber || ''),
      hpcsaRegistrationNumber: String(profile.hpcsaRegistrationNumber || ''),
      yearsOfExperience:
        profile.yearsOfExperience == null || profile.yearsOfExperience === ''
          ? ''
          : String(profile.yearsOfExperience),
      gender: String(profile.gender || ''),
      verificationStatus: String(profile.verificationStatus || ''),
    },
  };
}

export const ClinicAdminMemberAccountPage: React.FC = () => {
  const { memberId = '' } = useParams();
  const navigate = useNavigate();
  const { practiceSession } = useAuth();
  const { canManageMembers, isOwner } = usePermissions();
  const practice = practiceSession?.practice;
  const canManage = canManageMembers || isOwner;
  const isPracticeOwner = Boolean(practice && memberId === practice.ownerId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadedRole, setLoadedRole] = useState<PracticeRole>('doctor');
  const [draft, setDraft] = useState<MemberAccount>(emptyAccount());

  useEffect(() => {
    if (!practice?.id || !memberId) return;
    let cancelled = false;
    setLoading(true);
    djangoGetPracticeMemberAccount(practice.id, memberId)
      .then((raw) => {
        if (!cancelled) {
          const next = mapAccount(raw);
          setDraft(next);
          setLoadedRole(next.role);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this account.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [practice?.id, memberId]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!practice?.id || !canManage) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await djangoPatchPracticeMember(practice.id, memberId, {
        displayName: draft.displayName.trim(),
        email: draft.email.trim(),
        phoneNumber: draft.phoneNumber.trim(),
        isClinician: draft.isClinician,
        isActive: draft.isActive,
        ...(isPracticeOwner || draft.role === loadedRole
          ? {}
          : { role: draft.role, permissions: permissionsForRole(draft.role) }),
        title: draft.profile.title.trim(),
        specialty: draft.profile.specialty.trim(),
        licenseNumber: draft.profile.licenseNumber.trim(),
        hpcsaRegistrationNumber: draft.profile.hpcsaRegistrationNumber.trim(),
        gender: draft.profile.gender.trim(),
        yearsOfExperience:
          draft.profile.yearsOfExperience.trim() === ''
            ? ''
            : Number(draft.profile.yearsOfExperience),
      });
      const next = mapAccount(saved);
      setDraft(next);
      setLoadedRole(next.role);
      setSuccess('Team account saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this account.');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async () => {
    if (!practice?.id || isPracticeOwner) return;
    if (!window.confirm('Deactivate this person on the clinic team?')) return;
    setSaving(true);
    setError(null);
    try {
      await djangoDeactivatePracticeMember(practice.id, memberId);
      navigate('/clinic/team');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this member.');
      setSaving(false);
    }
  };

  if (!practice) return null;

  return (
    <PageShell className="py-6 sm:py-8">
      <Link to="/clinic/team" className="text-sm font-semibold text-anixi-green hover:underline">
        Back to team
      </Link>
      <PageHeader
        className="mt-3"
        title={draft.displayName || 'Team account'}
        description="Manage this person's clinic login, role, and professional details."
      />

      {loading ? (
        <p className="mt-6 text-sm text-[#65758b]">Loading account...</p>
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">Account</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-[#65758b]">
                Display name
                <input
                  className={fieldClass}
                  value={draft.displayName}
                  onChange={(e) => setDraft((current) => ({ ...current, displayName: e.target.value }))}
                  required
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Email
                <input
                  type="email"
                  className={fieldClass}
                  value={draft.email}
                  onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))}
                  required
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
                Role
                <select
                  className={fieldClass}
                  value={draft.role}
                  disabled={isPracticeOwner}
                  onChange={(e) => setDraft((current) => ({ ...current, role: e.target.value as PracticeRole }))}
                >
                  {isPracticeOwner ? <option value={draft.role}>{ROLE_LABELS[draft.role] || 'Owner'}</option> : null}
                  {INVITABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm text-[#344256]">
                <input
                  type="checkbox"
                  checked={draft.isClinician}
                  onChange={(e) => setDraft((current) => ({ ...current, isClinician: e.target.checked }))}
                />
                Appears as a bookable clinician
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm text-[#344256]">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  disabled={isPracticeOwner}
                  onChange={(e) => setDraft((current) => ({ ...current, isActive: e.target.checked }))}
                />
                Account can sign in
              </label>
            </div>
            <p className="mt-3 text-sm text-[#65758b]">
              {draft.assignedPatientCount} assigned patient{draft.assignedPatientCount === 1 ? '' : 's'}
              {draft.profile.verificationStatus
                ? ` · Verification ${draft.profile.verificationStatus.replace(/_/g, ' ')}`
                : ''}
            </p>
          </section>

          <section className="rounded-2xl border border-[#e1e7ef] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
              Professional details
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-[#65758b]">
                Title
                <input
                  className={fieldClass}
                  value={draft.profile.title}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      profile: { ...current.profile, title: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Specialty
                <input
                  className={fieldClass}
                  value={draft.profile.specialty}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      profile: { ...current.profile, specialty: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                HPCSA number
                <input
                  className={fieldClass}
                  value={draft.profile.hpcsaRegistrationNumber}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      profile: { ...current.profile, hpcsaRegistrationNumber: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                License number
                <input
                  className={fieldClass}
                  value={draft.profile.licenseNumber}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      profile: { ...current.profile, licenseNumber: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Years in practice
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={draft.profile.yearsOfExperience}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      profile: { ...current.profile, yearsOfExperience: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="text-xs font-medium text-[#65758b]">
                Gender
                <select
                  className={fieldClass}
                  value={draft.profile.gender}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      profile: { ...current.profile, gender: e.target.value },
                    }))
                  }
                >
                  <option value="">Not set</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || !canManage}
              className="rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save account'}
            </button>
            {!isPracticeOwner ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void removeMember()}
                className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600"
              >
                Deactivate on team
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate('/clinic/team')}
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

export default ClinicAdminMemberAccountPage;
