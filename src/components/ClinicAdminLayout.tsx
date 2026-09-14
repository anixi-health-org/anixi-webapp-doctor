import {
  Bars3Icon,
  CalendarDaysIcon,
  BanknotesIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  HomeIcon,
  LifebuoyIcon,
  QueueListIcon,
  UserGroupIcon,
  UsersIcon,
  XMarkIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AskAnixiProvider } from '../context/AskAnixiContext';
import { useAuth } from '../hooks/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { AnixiLogo } from './brand/AnixiLogo';
import { ClinicErrorBoundary } from './clinic/ClinicErrorBoundary';
import { UserProfileMenu } from './page-layout/UserProfileMenu';

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  requires?:
    | 'manageMembers'
    | 'managePatients'
    | 'manageAppointments'
    | 'editBookingPolicies'
    | 'viewBilling';
};

const mainNav: NavItem[] = [
  { name: 'Overview', href: '/clinic', icon: HomeIcon },
  {
    name: 'Team & doctors',
    href: '/clinic/team',
    icon: UserGroupIcon,
    requires: 'manageMembers',
  },
  {
    name: 'Patients',
    href: '/clinic/patients',
    icon: UsersIcon,
    requires: 'managePatients',
  },
  {
    name: 'Schedule',
    href: '/clinic/schedule',
    icon: CalendarDaysIcon,
    requires: 'manageAppointments',
  },
  {
    name: 'Front desk',
    href: '/clinic/queue',
    icon: QueueListIcon,
    requires: 'manageAppointments',
  },
  {
    name: 'Rooms',
    href: '/clinic/rooms',
    icon: BuildingOffice2Icon,
    requires: 'manageAppointments',
  },
  {
    name: 'Reports',
    href: '/clinic/reports',
    icon: ChartBarIcon,
  },
  {
    name: 'Audit log',
    href: '/clinic/audit',
    icon: DocumentTextIcon,
    requires: 'manageMembers',
  },
  {
    name: 'Invoices',
    href: '/clinic/invoices',
    icon: BanknotesIcon,
    requires: 'viewBilling',
  },
  {
    name: 'Claims',
    href: '/clinic/claims',
    icon: ClipboardDocumentListIcon,
    requires: 'viewBilling',
  },
  {
    name: 'Clinic settings',
    href: '/clinic/settings',
    icon: Cog6ToothIcon,
  },
];

const supportNav: NavItem = {
  name: 'Support',
  href: '/clinic/support',
  icon: LifebuoyIcon,
};

function NavLink({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: (path: string) => boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isActive(item.href);

  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      className={clsx(
        'group flex w-full items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[14px] font-medium leading-snug transition-all duration-200',
        active
          ? 'bg-white text-[#344256] shadow-sm'
          : 'text-white/90 hover:bg-white/15 hover:text-white hover:shadow-sm'
      )}
    >
      <Icon
        className={clsx(
          'h-5 w-5 shrink-0',
          active ? 'text-anixi-green' : 'text-white/80 group-hover:text-white'
        )}
      />
      <span className="truncate">{item.name}</span>
    </Link>
  );
}

export const ClinicAdminLayout: React.FC = () => (
  <AskAnixiProvider>
    <ClinicAdminShell />
  </AskAnixiProvider>
);

const ClinicAdminShell: React.FC = () => {
  const { user, practiceSession } = useAuth();
  const { can, isOwner, isPracticeManager } = usePermissions();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const visibleNav = React.useMemo(
    () =>
      mainNav.filter((item) => {
        if (!item.requires) return true;
        if (isOwner || isPracticeManager) return true;
        if (item.requires === 'editBookingPolicies' && can('viewBilling')) return true;
        if (item.requires === 'manageAppointments') return can('manageAppointments');
        if (item.requires === 'viewBilling') return can('viewBilling');
        return can(item.requires);
      }),
    [can, isOwner, isPracticeManager]
  );

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/clinic') {
      return location.pathname === '/clinic';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const closeMobile = () => setMobileNavOpen(false);
  const firstName = user?.displayName?.split(' ')[0] || 'Admin';
  const clinicName = practiceSession?.practice?.name || 'Your clinic';

  const sidebarNav = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col overflow-hidden px-3 pb-5 pt-2">
      <div className="flex-1 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => (
          <NavLink key={item.name} item={item} isActive={isActive} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="mt-4 border-t border-white/15 pt-4">
        <NavLink item={supportNav} isActive={isActive} onNavigate={onNavigate} />
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f4f2]">
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col bg-anixi-green">
        <div className="border-b border-white/10 px-4 py-5">
          <AnixiLogo variant="sidebar" subtitle="CLINIC ADMIN" linkTo="/clinic" />
        </div>
        {sidebarNav()}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-30 border-b border-[#dfe6e1] bg-white shadow-sm shadow-[#1a4d4d]/5">
          <div className="flex h-[4.25rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e1e7ef] text-[#65758b] md:hidden"
              aria-label="Open navigation"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-heading text-2xl font-bold tracking-tight text-[#1a4d4d] sm:text-[1.75rem]">
                {clinicName}
              </h1>
            </div>
            <UserProfileMenu subtitle="Clinic admin" displayLabel={firstName} />
          </div>
        </header>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
              onClick={closeMobile}
              aria-label="Close navigation"
            />
            <div className="absolute left-0 top-0 flex h-full w-[min(280px,88vw)] flex-col bg-anixi-green shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <AnixiLogo
                  variant="sidebar"
                  subtitle="CLINIC ADMIN"
                  linkTo="/clinic"
                  onClick={closeMobile}
                />
                <button
                  type="button"
                  onClick={closeMobile}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
                  aria-label="Close navigation"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                {sidebarNav(closeMobile)}
                <div className="px-3 pb-6">
                  <UserProfileMenu variant="mobile" onNavigate={closeMobile} />
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <ClinicErrorBoundary key={location.pathname}>
            <Outlet />
          </ClinicErrorBoundary>
        </main>
      </div>
    </div>
  );
};
