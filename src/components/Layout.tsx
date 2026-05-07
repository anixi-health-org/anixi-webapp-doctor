import {
    ArrowRightOnRectangleIcon,
    CalendarIcon,
    Cog6ToothIcon,
    HomeIcon,
    UserGroupIcon,
    ShareIcon,
    QuestionMarkCircleIcon,
    BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Appointments', href: '/appointments', icon: CalendarIcon },
    { name: 'My Patients', href: '/patients', icon: UserGroupIcon },
    { name: 'Practice Settings', href: '/practice-settings', icon: BuildingOffice2Icon },
    { name: 'Professional Profile', href: '/professional-profile', icon: Cog6ToothIcon },
    { name: 'Share Anixi', href: '/share-anixi', icon: ShareIcon },
    { name: 'Support', href: '/support', icon: QuestionMarkCircleIcon },
  ];
  return (
    <div className="min-h-screen bg-anixi-beige flex">
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex items-center h-16 px-4 bg-anixi-green">
            <h1 className="text-xl font-semibold text-white">Anixi Health</h1>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-2 bg-anixi-green">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive(item.href)
                      ? 'bg-anixi-beige text-anixi-green'
                      : 'text-anixi-beige hover:bg-opacity-20 hover:bg-white'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-anixi-beige border-opacity-30 p-4 bg-anixi-green">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-anixi-beige flex items-center justify-center">
                  <span className="text-anixi-green text-sm font-medium">
                    {user?.displayName?.charAt(0) || 'D'}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-anixi-beige">{user?.displayName || 'Doctor'}</p>
                <p className="text-xs text-anixi-beige text-opacity-70">{user?.email}</p>
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <Link
                to="/professional-profile"
                className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-anixi-beige hover:bg-anixi-beige hover:text-anixi-green transition-colors"
              >
                <Cog6ToothIcon className="mr-3 h-5 w-5" />
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="group flex w-full items-center px-2 py-2 text-sm font-medium rounded-md text-anixi-beige hover:bg-anixi-beige hover:text-anixi-green transition-colors"
              >
                <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-anixi-beige">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-anixi-green">
                {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
              </h1>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-anixi-green font-medium">
                  Welcome back, Dr. {user?.displayName || 'Doctor'}
                </span>
                <div className="h-8 w-8 rounded-full bg-anixi-green flex items-center justify-center">
                  <span className="text-anixi-beige text-sm font-medium">
                    {user?.displayName?.charAt(0) || 'D'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};
