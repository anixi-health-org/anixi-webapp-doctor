import { djangoListMyEmployers } from './djangoApiService';
import type { EmployeeEnrollment, EmployerMember, EmployerOrg } from '../types';

export async function createEmployerOrg(
  _ownerId: string,
  _input: Pick<EmployerOrg, 'name' | 'industry' | 'city' | 'province' | 'employeeTarget'>,
): Promise<string> {
  throw new Error('Employer creation is not yet available via Django API.');
}

export async function getEmployerForUser(_uid: string): Promise<EmployerOrg | null> {
  const rows = await djangoListMyEmployers();
  if (!rows.length) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    name: String(row.name ?? 'Employer'),
    ownerId: _uid,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function listEmployerEnrollments(_employerId: string): Promise<EmployeeEnrollment[]> {
  return [];
}

export async function addEmployeeEnrollment(
  _employerId: string,
  _email: string,
  _displayName?: string,
): Promise<void> {
  throw new Error('Employee enrollment is not yet available via Django API.');
}

export async function getEmployerDashboardStats(employerId: string): Promise<{
  enrolled: number;
  active: number;
  invited: number;
}> {
  const rows = await listEmployerEnrollments(employerId);
  return {
    enrolled: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    invited: rows.filter((r) => r.status === 'invited').length,
  };
}

export async function getEmployerMember(
  _employerId: string,
  _uid: string,
): Promise<EmployerMember | null> {
  return null;
}
