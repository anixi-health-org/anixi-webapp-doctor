import React, { useState } from 'react';
import { BulkDoctorInvitePanel } from '../../components/onboarding/BulkDoctorInvitePanel';
import { PracticeMembersPanel } from '../../components/practice/PracticeMembersPanel';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

export const ClinicAdminTeamPage: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const { canManageMembers, isOwner } = usePermissions();
  const practice = practiceSession?.practice;
  const [reloadToken, setReloadToken] = useState(0);

  if (!user || !practice) {
    return null;
  }

  const canManage = canManageMembers || isOwner;

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
          <div className="mt-6 max-w-4xl">
            <BulkDoctorInvitePanel
              practiceId={practice.id}
              practiceName={practice.name}
              invitedBy={user.id}
              invitedByName={user.displayName || 'Clinic admin'}
              onComplete={() => setReloadToken((n) => n + 1)}
            />
          </div>

          <div className="mt-8">
            <PracticeMembersPanel variant="clinic" reloadToken={reloadToken} />
          </div>
        </>
      )}
    </PageShell>
  );
};

export default ClinicAdminTeamPage;
