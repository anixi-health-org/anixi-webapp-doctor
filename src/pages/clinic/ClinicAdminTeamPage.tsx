import React, { useState } from 'react';
import { BulkDoctorInvitePanel } from '../../components/onboarding/BulkDoctorInvitePanel';
import { ClinicSecondaryAction } from '../../components/clinic/ClinicSecondaryAction';
import { PracticeMembersPanel } from '../../components/practice/PracticeMembersPanel';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

export const ClinicAdminTeamPage: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const { canManageMembers, isOwner } = usePermissions();
  const practice = practiceSession?.practice;
  const [reloadToken, setReloadToken] = useState(0);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  if (!user || !practice) {
    return null;
  }

  const canManage = canManageMembers || isOwner;
  const hasTeam = (memberCount ?? 0) > 0;
  const showCsv = canManage && (memberCount === 0 || csvOpen);

  const csvPanel = canManage ? (
    <BulkDoctorInvitePanel
      practiceId={practice.id}
      practiceName={practice.name}
      invitedBy={user.id}
      invitedByName={user.displayName || 'Clinic admin'}
      onComplete={() => setReloadToken((n) => n + 1)}
    />
  ) : null;

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Team & doctors"
        description="Invite clinicians and front-desk staff. Each person receives an email to create their own login."
      />

      {!canManage ? (
        <div className="mt-6 rounded-2xl border border-[#e1e7ef] bg-white p-5 text-sm text-[#65758b]">
          You don&apos;t have permission to manage the clinic team. Ask a practice manager or owner.
        </div>
      ) : (
        <>
          {showCsv && !hasTeam ? <div className="mt-6">{csvPanel}</div> : null}

          <div className="mt-8">
            <PracticeMembersPanel
              variant="clinic"
              reloadToken={reloadToken}
              onLoaded={({ memberCount: nextCount }) => setMemberCount(nextCount)}
              extraHeaderActions={
                hasTeam ? (
                  <ClinicSecondaryAction
                    open={csvOpen}
                    onToggle={() => setCsvOpen((open) => !open)}
                    revealLabel="Invite from CSV"
                    hideLabel="Hide CSV invite"
                  />
                ) : null
              }
            />
          </div>

          {showCsv && hasTeam ? <div className="mt-8">{csvPanel}</div> : null}
        </>
      )}
    </PageShell>
  );
};

export default ClinicAdminTeamPage;
