import React from 'react';
import {
  ASSIGNABLE_ROLES,
  CORE_PRACTICE_ROLES,
  INVITABLE_ROLES,
  LEGACY_PRACTICE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  normalizeMemberRoles,
} from '../../lib/practiceRoles';
import type { PracticeRole } from '../../types';

type PracticeRoleMultiSelectProps = {
  value: PracticeRole[];
  onChange: (roles: PracticeRole[]) => void;
  /** Invites hide owner; member edit may include legacy roles. */
  mode?: 'invite' | 'member';
  disabled?: boolean;
  className?: string;
};

const toggleRole = (current: PracticeRole[], role: PracticeRole): PracticeRole[] => {
  const set = new Set(current);
  if (set.has(role)) {
    set.delete(role);
  } else {
    set.add(role);
  }
  const next = Array.from(set);
  return next.length ? normalizeMemberRoles(next[0], next) : current;
};

export const PracticeRoleMultiSelect: React.FC<PracticeRoleMultiSelectProps> = ({
  value,
  onChange,
  mode = 'invite',
  disabled = false,
  className = '',
}) => {
  const roles =
    mode === 'invite'
      ? INVITABLE_ROLES
      : [...CORE_PRACTICE_ROLES, ...LEGACY_PRACTICE_ROLES.filter((r) => ASSIGNABLE_ROLES.includes(r))];

  const selected = normalizeMemberRoles(value[0] ?? 'doctor', value);

  return (
    <fieldset
      className={`rounded-xl border border-gray-200 bg-[#fafcfb] p-3 ${className}`}
      disabled={disabled}
    >
      <legend className="px-1 text-sm font-medium text-gray-700">Roles (select all that apply)</legend>
      <p className="mb-3 text-xs text-gray-500">
        Capabilities combine across roles, e.g. Doctor + Content Creator gets clinical and content tools.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {roles.map((role) => {
          const checked = selected.includes(role);
          return (
            <li key={role}>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:bg-white">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-gray-300 text-anixi-green focus:ring-anixi-green/30"
                  checked={checked}
                  onChange={() => onChange(toggleRole(selected, role))}
                />
                <span className="text-sm text-gray-800">
                  <span className="font-medium">{ROLE_LABELS[role]}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{ROLE_DESCRIPTIONS[role]}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
};
