import React, { useEffect, useState } from 'react';
import { DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import { patientDisplayInitials } from '../../lib/patientDisplayInitials';
import { djangoResolveMediaUrl } from '../../services/djangoApiService';

type Props = {
  displayName?: string;
  profileImageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showWarriorBadge?: boolean;
  className?: string;
};

const sizeClasses: Record<NonNullable<Props['size']>, { ring: string; text: string; badge: string }> = {
  sm: { ring: 'h-9 w-9 text-xs', text: 'text-xs', badge: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5' },
  md: { ring: 'h-11 w-11 text-sm', text: 'text-sm', badge: 'h-4 w-4 -bottom-0.5 -right-0.5' },
  lg: { ring: 'h-16 w-16 text-lg', text: 'text-lg', badge: 'h-5 w-5 bottom-0 right-0' },
  hero: { ring: 'h-28 w-28 sm:h-32 sm:w-32 text-2xl', text: 'text-2xl', badge: 'h-6 w-6 bottom-1 right-1' },
};

export const PatientWarriorAvatar: React.FC<Props> = ({
  displayName,
  profileImageUrl,
  size = 'md',
  showWarriorBadge = false,
  className = '',
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>();
  const dims = sizeClasses[size];
  const initials = patientDisplayInitials(displayName);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const url = await djangoResolveMediaUrl(profileImageUrl);
      if (!cancelled) setResolvedSrc(url);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [profileImageUrl]);

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#427160] to-[#2d4d42] shadow-md ring-4 ring-white ${dims.ring}`}
        aria-hidden
      >
        {resolvedSrc ? (
          <img
            src={resolvedSrc}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center font-semibold text-white ${dims.text}`}
          >
            {initials}
          </span>
        )}
      </div>
      {showWarriorBadge && resolvedSrc ? (
        <span
          className={`absolute inline-flex items-center justify-center rounded-full border-2 border-white bg-[#0E2340] text-white ${dims.badge}`}
          title="Photo from Warrior app"
        >
          <DevicePhoneMobileIcon className="h-3 w-3" />
        </span>
      ) : null}
    </div>
  );
};
