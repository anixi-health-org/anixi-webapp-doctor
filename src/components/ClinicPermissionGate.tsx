import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import type { PracticePermissions } from '../types';
import { PageShell } from './page-layout';

type ClinicPermissionGateProps = {
  requires: keyof PracticePermissions;
  /** Active clinic clinicians may open assigned-patient workflows (server enforces scope). */
  allowClinician?: boolean;
  children: React.ReactNode;
};

export const ClinicPermissionGate: React.FC<ClinicPermissionGateProps> = ({
  requires,
  allowClinician = false,
  children,
}) => {
  const { can, isOwner, isPracticeManager, isClinician } = usePermissions();
  const allowed =
    isOwner ||
    isPracticeManager ||
    can(requires) ||
    (allowClinician && isClinician);

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <PageShell>
      <div className="rounded-2xl border border-[#e1e7ef] bg-white px-6 py-10 text-center">
        <h1 className="font-heading text-xl font-semibold text-[#1a4d4d]">Access denied</h1>
        <p className="mt-2 text-sm text-[#65758b]">
          You do not have permission to view this clinic page. Ask a clinic owner or practice
          manager if you need access.
        </p>
      </div>
    </PageShell>
  );
};
