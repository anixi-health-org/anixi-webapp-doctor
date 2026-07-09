export type AuthRole = 'doctor' | 'caregiver';

export const AUTH_ROLE_LABELS: Record<AuthRole, string> = {
  doctor: 'Doctor',
  caregiver: 'Caregiver',
};

export const AUTH_PORTAL_LABELS: Record<AuthRole, string> = {
  doctor: 'Anixi Doctor Portal',
  caregiver: 'Anixi Caregiver Portal',
};

export function parseAuthRole(value: string | null): AuthRole | null {
  if (value === 'doctor' || value === 'caregiver') return value;
  return null;
}
