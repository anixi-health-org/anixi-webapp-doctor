import {
  Bars3Icon,
  HomeIcon,
  LifebuoyIcon,
  UserCircleIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { getTimeGreeting } from '../lib/greeting';
import { useAuth } from '../hooks/useAuth';
import { AnixiLogo } from './brand/AnixiLogo';
import { UserProfileMenu } from './page-layout/UserProfileMenu';

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const mainNav: NavItem[] = [
  { name: 'Dashboard', href: '/caregiver', icon: HomeIcon },
  { name: 'My Patients', href: '/caregiver/patients', icon: UserGroupIcon },
  { name: 'My Profile', href: '/caregiver/profile', icon: UserCircleIcon },
];

const supportNav: NavItem = {
  name: 'Support',
  href: '/caregiver/support',
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
        'group flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium leading-snug transition-all duration-150',
        active
          ? 'bg-white text-anixi-green shadow-sm'
          : 'text-white hover:bg-white/10'
      )}
    >
      <Icon
        className={clsx(
          'h-6 w-6 shrink-0 transition-colors',
          active ? 'text-anixi-green' : 'text-white/85 group-hover:text-white'
        )}
      />
      <span className="truncate">{item.name}</span>
    </Link>
  );
}

export const CaregiverLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/caregiver') {
      return location.pathname === '/caregiver';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const closeMobile = () => setMobileNavOpen(false);
  const firstName = user?.displayName?.split(' ')[0] || 'Caregiver';
  const greeting = getTimeGreeting();

  const sidebarNav = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col overflow-hidden px-4 pb-5">
      <div className="flex-1 space-y-1 overflow-y-auto">
        {mainNav.map((item) => (
          <NavLink key={item.name} item={item} isActive={isActive} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="mt-5 border-t border-white/15 pt-4">
        <NavLink item={supportNav} isActive={isActive} onNavigate={onNavigate} />
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6EF]">
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-[272px] md:flex-col bg-anixi-green">
        <div className="px-5 py-6">
          <AnixiLogo variant="sidebar" subtitle="CAREGIVER PORTAL" linkTo="/caregiver" />
        </div>
        {sidebarNav()}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-[272px]">
        <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/90 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 md:hidden"
                aria-label="Open navigation"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate font-heading text-base font-semibold tracking-tight text-gray-900">
                  {greeting}, {firstName}
                </p>
              </div>
            </div>

            <UserProfileMenu />
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
            <div className="absolute left-0 top-0 flex h-full w-[min(300px,88vw)] flex-col bg-anixi-green shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <AnixiLogo
                  variant="sidebar"
                  subtitle="CAREGIVER PORTAL"
                  linkTo="/caregiver"
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
          <Outlet />
        </main>
      </div>
    </div>
  );
};
