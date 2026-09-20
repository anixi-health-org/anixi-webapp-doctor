import {
  Bars3Icon,
  BellIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  HeartIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useIncomingRecordShares } from '../hooks/useIncomingRecordShares';
import { useIncomingSharingRequests } from '../hooks/useIncomingSharingRequests';
import { usePendingAppointmentsCount } from '../hooks/usePendingAppointments';
import {
  getUnreadPingCount,
  listenToDoctorConversations,
} from '../services/conversationService';
import { NotificationBell } from './notifications/NotificationBell';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { GlobalPatientSearch } from './ui/GlobalPatientSearch';
import { UserProfileMenu } from './page-layout/UserProfileMenu';
import { AnixiLogo } from './brand/AnixiLogo';
import { clinicianHeaderLabel } from '../lib/clinicianName';
import { AskAnixiProvider } from '../context/AskAnixiContext';
import { AyahChatProvider } from '../context/AyahChatContext';

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: number;
  badgeTone?: 'teal' | 'red';
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
        'group flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[14px] font-medium leading-snug transition-all duration-200',
        active
          ? 'bg-white text-[#344256] shadow-sm'
          : 'text-white/90 hover:bg-white/15 hover:text-white hover:shadow-sm'
      )}
    >
      <Icon
        className={clsx(
          'h-5 w-5 shrink-0 transition-colors duration-200',
          active ? 'text-anixi-green' : 'text-white/80 group-hover:text-white'
        )}
      />
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      {typeof item.badge === 'number' && item.badge > 0 && (
        <span
          className={clsx(
            'inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
            item.badgeTone === 'red'
              ? 'bg-[#ef4343] text-white'
              : 'bg-[#2a9d8f] text-white'
          )}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  );
}

const DoctorShell: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isClinicEmployedClinician } = usePermissions();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const { requests: sharingRequests } = useIncomingSharingRequests(user?.id);
  const pendingRequests = sharingRequests.filter((r) => r.status === 'pending').length;
  const pendingAppointments = usePendingAppointmentsCount(user?.id);
  const { requests: recordShareRequests } = useIncomingRecordShares(user?.id);
  const pendingRecordShares = recordShareRequests.length;
  const [unreadMessages, setUnreadMessages] = React.useState(0);

  React.useEffect(() => {
    if (!user?.id) {
      setUnreadMessages(0);
      return;
    }
    return listenToDoctorConversations(user.id, (conversations) => {
      setUnreadMessages(getUnreadPingCount(conversations, user.id));
    });
  }, [user?.id]);

  const isAccessGate =
    location.pathname === '/onboarding' || location.pathname === '/account-review';
  const isFocusCall = location.pathname.startsWith('/teleconsult/');

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  if (isAccessGate || isFocusCall) {
    return <>{children || <Outlet />}</>;
  }

  const isActive = (path: string) => {
    if (path === '/ayah') return location.pathname === '/ayah';
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const closeMobile = () => setMobileNavOpen(false);

  const primaryNav: NavItem[] = [
    { name: 'Ayah', href: '/ayah', icon: SparklesIcon },
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    {
      name: 'Patients',
      href: '/patients',
      icon: UserGroupIcon,
      badge: pendingRequests || undefined,
      badgeTone: 'teal',
    },
    {
      name: 'Appointments',
      href: '/appointments',
      icon: CalendarIcon,
      badge: pendingAppointments || undefined,
      badgeTone: 'teal',
    },
    {
      name: 'Medical Records',
      href: '/medical-records',
      icon: ClipboardDocumentListIcon,
      badge: pendingRecordShares || undefined,
      badgeTone: 'teal',
    },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  ];

  const secondaryNav: NavItem[] = [
    { name: 'Messages', href: '/messages', icon: ChatBubbleLeftRightIcon, badge: unreadMessages || undefined, badgeTone: 'red' },
    { name: 'Notifications', href: '/notifications', icon: BellIcon, badgeTone: 'red' },
    { name: 'Health Monitor', href: '/health-monitor', icon: HeartIcon },
  ];

  const practiceNav: NavItem[] = [
    { name: 'Invoices', href: '/invoices', icon: CurrencyDollarIcon },
    {
      name: isClinicEmployedClinician ? 'My calendar' : 'Practice Calendar',
      href: '/practice-calendar',
      icon: CalendarDaysIcon,
    },
    {
      name: isClinicEmployedClinician ? 'My schedule' : 'Settings',
      href: '/practice-settings',
      icon: WrenchScrewdriverIcon,
    },
  ];

  const supportNav: NavItem = {
    name: 'Support',
    href: '/support',
    icon: QuestionMarkCircleIcon,
  };

  const sidebarNav = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col overflow-hidden px-3 pb-5">
      <div className="flex-1 space-y-1 overflow-y-auto">
        {primaryNav.map((item) => (
          <NavLink key={item.name} item={item} isActive={isActive} onNavigate={onNavigate} />
        ))}
        <div className="my-3 border-t border-white/15" />
        {secondaryNav.map((item) => (
          <NavLink key={item.name} item={item} isActive={isActive} onNavigate={onNavigate} />
        ))}
        <div className="my-3 border-t border-white/15" />
        {practiceNav.map((item) => (
          <NavLink key={item.name} item={item} isActive={isActive} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="mt-4 border-t border-white/15 pt-4">
        <NavLink item={supportNav} isActive={isActive} onNavigate={onNavigate} />
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col bg-anixi-green">
        <div className="border-b border-white/10 px-4 py-5">
          <AnixiLogo variant="sidebar" />
        </div>
        {sidebarNav()}
      </aside>

      <div className="flex min-w-0 flex-1 md:pl-64">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[#e1e7ef] bg-white">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#e1e7ef] text-[#65758b] transition-all duration-200 hover:border-[#427160]/30 hover:bg-[#eef4f1] hover:text-[#427160] md:hidden"
                aria-label="Open navigation"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <div className="hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-lg">
                <GlobalPatientSearch variant="expanded" />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="md:hidden">
                <GlobalPatientSearch />
              </div>
              <WorkspaceSwitcher className="hidden sm:inline-flex" />
              <NotificationBell />
              <UserProfileMenu
                subtitle="Physician"
                displayLabel={clinicianHeaderLabel(user?.displayName)}
              />
            </div>
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
                <AnixiLogo variant="sidebar" linkTo="/ayah" onClick={closeMobile} />
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

          <main className={`flex-1 ${location.pathname === '/ayah' || location.pathname === '/dashboard' ? 'min-h-0 overflow-hidden' : 'overflow-y-auto'}`}>
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </div>
  );
};

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AskAnixiProvider>
    <AyahChatProvider>
      <DoctorShell>{children}</DoctorShell>
    </AyahChatProvider>
  </AskAnixiProvider>
);
