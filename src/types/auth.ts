export type AuthRole = 'doctor' | 'caregiver' | 'staff';

/** How a professional is joining the portal */
export type JoinPath = 'solo_doctor' | 'clinic' | 'market_partner' | 'invite' | 'caregiver';

export const AUTH_ROLE_LABELS: Record<AuthRole, string> = {
  doctor: 'Doctor',
  caregiver: 'Caregiver',
  staff: 'Clinic Staff',
};

export const AUTH_PORTAL_LABELS: Record<AuthRole, string> = {
  doctor: 'Anixi Doctor Portal',
  caregiver: 'Anixi Caregiver Portal',
  staff: 'Anixi Practice Portal',
};

export function parseAuthRole(value: string | null): AuthRole | null {
  if (value === 'doctor' || value === 'caregiver' || value === 'staff') return value;
  return null;
}

export function parseJoinPath(value: string | null): JoinPath | null {
  if (
    value === 'solo_doctor' ||
    value === 'clinic' ||
    value === 'market_partner' ||
    value === 'invite' ||
    value === 'caregiver'
  ) {
    return value;
  }
  return null;
}
