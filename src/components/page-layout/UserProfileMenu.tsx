import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  ShareIcon,
  TrashIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { usesClinicAdminPortal } from '../../lib/doctorAccess';

interface UserProfileMenuProps {
  variant?: 'header' | 'mobile';
  onNavigate?: () => void;
  subtitle?: string;
  displayLabel?: string;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  variant = 'header',
  onNavigate,
  subtitle,
  displayLabel,
}) => {
  const { user, logout, practiceSession } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCaregiver = user?.role === 'caregiver';
  const isClinicAdmin = usesClinicAdminPortal(practiceSession);
  const displayName = user?.displayName || (isCaregiver ? 'Caregiver' : 'Doctor');
  const initial = displayName.charAt(0).toUpperCase();
  const email = user?.email || '';
  const shortName = displayName.split(' ')[0];
  const headerLabel =
    displayLabel ||
    (isCaregiver || isClinicAdmin ? shortName : `Dr. ${shortName}`);
  const headerSubtitle =
    subtitle || (isCaregiver ? 'Caregiver' : isClinicAdmin ? 'Clinic admin' : 'Physician');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const close = () => setOpen(false);

  const handleNavigate = (path: string) => {
    close();
    onNavigate?.();
    navigate(path);
  };

  const handleLogout = async () => {
    close();
    onNavigate?.();
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const menuItems = isCaregiver
    ? [
        {
          label: 'My Profile',
          icon: UserCircleIcon,
          onClick: () => handleNavigate('/caregiver/profile'),
        },
        {
          label: 'Share Anixi',
          icon: ShareIcon,
          onClick: () => handleNavigate('/caregiver/share'),
        },
        {
          label: 'Change Password',
          icon: LockClosedIcon,
          onClick: () => handleNavigate('/caregiver/change-password'),
        },
      ]
    : isClinicAdmin
      ? [
          {
            label: 'Clinic settings',
            icon: Cog6ToothIcon,
            onClick: () => handleNavigate('/clinic/settings'),
          },
          {
            label: 'Change Password',
            icon: LockClosedIcon,
            onClick: () => handleNavigate('/clinic/change-password'),
          },
        ]
      : [
          {
            label: 'Professional Profile',
            icon: UserCircleIcon,
            onClick: () => handleNavigate('/professional-profile'),
          },
          {
            label: 'Share Anixi',
            icon: ShareIcon,
            onClick: () => handleNavigate('/share-anixi'),
          },
          {
            label: 'Change Password',
            icon: LockClosedIcon,
            onClick: () => handleNavigate('/change-password'),
          },
        ];

  const deleteAccountPath = isCaregiver
    ? '/caregiver/delete-account'
    : isClinicAdmin
      ? '/clinic/delete-account'
      : '/delete-account';

  if (variant === 'mobile') {
    return (
      <div className="space-y-1 border-t border-white/10 pt-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
          Account
        </p>
        {menuItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
          >
            <item.icon className="h-5 w-5 shrink-0 opacity-80" />
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleNavigate(deleteAccountPath)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10"
        >
          <TrashIcon className="h-5 w-5 shrink-0" />
          Delete Account
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-[8px] px-1.5 py-1 transition-all hover:bg-[#f8fafc]"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open account menu"
      >
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#427160] text-sm font-semibold text-white">
          {user?.role === 'doctor' && user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            initial
          )}
        </div>
        <div className="hidden min-w-0 text-left lg:block">
          <p className="max-w-[140px] truncate text-sm font-semibold text-[#0a0a0a]">
            {headerLabel}
          </p>
          <p className="max-w-[140px] truncate text-xs text-[#65758b]">{headerSubtitle}</p>
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-[#65758b] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/50"
          role="menu"
        >
          <div className="border-b border-gray-100 bg-gradient-to-br from-anixi-green/5 to-transparent px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-anixi-green text-base font-semibold text-white">
                {user?.role === 'doctor' && user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-sans text-sm font-semibold text-gray-900">
                  {isCaregiver || isClinicAdmin ? displayName : `Dr. ${displayName}`}
                </p>
                <p className="truncate text-xs text-gray-500">{email}</p>
              </div>
            </div>
          </div>

          <div className="p-1.5">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={item.onClick}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                <item.icon className="h-5 w-5 shrink-0 text-gray-400" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => handleNavigate(deleteAccountPath)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              <TrashIcon className="h-5 w-5 shrink-0" />
              Delete Account
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0 text-gray-400" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
