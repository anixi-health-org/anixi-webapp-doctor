import React from 'react';
import { PageShell } from '../../components/page-layout';
import { ClinicRoomsManager } from '../../components/clinic/ClinicRoomsManager';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

export const ClinicAdminRoomsPage: React.FC = () => {
  const { practiceSession, refreshPracticeSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const canManage = can('editBookingPolicies') || can('manageAppointments');

  if (!practice) {
    return null;
  }

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <ClinicRoomsManager
        practice={practice}
        canManage={canManage}
        onPracticeUpdated={refreshPracticeSession}
      />
    </PageShell>
  );
};

export default ClinicAdminRoomsPage;
