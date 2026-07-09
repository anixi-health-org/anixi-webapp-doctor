import React from 'react';
import { Heart, Stethoscope } from 'lucide-react';
import clsx from 'clsx';
import { AuthRole } from '../../types/auth';

interface RoleSelectorProps {
  selectedRole: AuthRole | null;
  onSelect: (role: AuthRole) => void;
}

const ROLES: {
  role: AuthRole;
  label: string;
  description: string;
  Icon: typeof Stethoscope;
}[] = [
  {
    role: 'doctor',
    label: 'Doctor',
    description: 'Provide medical expertise and care',
    Icon: Stethoscope,
  },
  {
    role: 'caregiver',
    label: 'Caregiver',
    description: 'Offer compassionate support and assistance',
    Icon: Heart,
  },
];

export const RoleSelector: React.FC<RoleSelectorProps> = ({ selectedRole, onSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {ROLES.map(({ role, label, description, Icon }) => {
        const isSelected = selectedRole === role;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onSelect(role)}
            className={clsx(
              'group flex flex-col items-center rounded-xl border-2 p-6 text-center transition-all duration-200',
              isSelected
                ? 'border-anixi-green bg-anixi-green/[0.04] shadow-md scale-[1.02]'
                : 'border-gray-200 bg-white hover:border-anixi-green/40 hover:shadow-sm'
            )}
          >
            <div
              className={clsx(
                'mb-4 flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-200',
                isSelected
                  ? 'bg-anixi-green text-white'
                  : 'bg-gray-100 text-gray-600 group-hover:bg-anixi-green/10 group-hover:text-anixi-green'
              )}
            >
              <Icon className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <span className="text-base font-semibold text-gray-900">{label}</span>
            <span className="mt-1.5 text-sm leading-snug text-gray-500">{description}</span>
          </button>
        );
      })}
    </div>
  );
};
