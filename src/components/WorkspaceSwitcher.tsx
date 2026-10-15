import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { canSwitchWorkspaces } from '../lib/doctorAccess';

type Workspace = 'clinical' | 'clinic';

export const WorkspaceSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { practiceSession } = useAuth();
  const location = useLocation();

  if (!canSwitchWorkspaces(practiceSession)) {
    return null;
  }

  const isClinic =
    location.pathname === '/clinic' || location.pathname.startsWith('/clinic/');
  const active: Workspace = isClinic ? 'clinic' : 'clinical';

  const tabs: { id: Workspace; label: string; href: string }[] = [
    { id: 'clinical', label: 'Clinical', href: '/ayah' },
    { id: 'clinic', label: 'Clinic ops', href: '/clinic' },
  ];

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] p-1',
        className,
      )}
      role="group"
      aria-label="Switch workspace"
    >
      <ArrowsRightLeftIcon className="hidden h-4 w-4 text-[#65758b] sm:block sm:ml-1" />
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.href}
          className={clsx(
            'rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm',
            active === tab.id
              ? 'bg-white text-[#344256] shadow-sm'
              : 'text-[#65758b] hover:text-[#344256]',
          )}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
};
