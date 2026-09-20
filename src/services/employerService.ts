import {
  djangoAddEmployerEnrollment,
  djangoCreateEmployer,
  djangoListEmployerEnrollments,
  djangoListMyEmployers,
  isDjangoApiEnabled,
} from './djangoApiService';
import type { EmployeeEnrollment, EmployerMember, EmployerOrg } from '../types';

function mapEmployer(row: Record<string, unknown>, fallbackOwnerId: string): EmployerOrg {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Employer'),
    industry: typeof row.industry === 'string' ? row.industry : undefined,
    city: typeof row.city === 'string' ? row.city : undefined,
    province: typeof row.province === 'string' ? row.province : undefined,
    ownerId: String(row.ownerId ?? fallbackOwnerId),
    employeeTarget:
      typeof row.employeeTarget === 'number' ? row.employeeTarget : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function mapEnrollment(
  row: Record<string, unknown>,
  employerId: string,
): EmployeeEnrollment {
  const status = row.status === 'active' || row.status === 'inactive' ? row.status : 'invited';
  return {
    id: String(row.id),
    employerId,
    email: String(row.email ?? ''),
    displayName: typeof row.displayName === 'string' ? row.displayName : undefined,
    patientId: row.patientId ? String(row.patientId) : undefined,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function createEmployerOrg(
  ownerId: string,
  input: Pick<EmployerOrg, 'name' | 'industry' | 'city' | 'province' | 'employeeTarget'>,
): Promise<string> {
  if (!isDjangoApiEnabled()) {
    throw new Error('Employer creation requires the Anixi API.');
  }
  const row = await djangoCreateEmployer({
    name: input.name,
    industry: input.industry,
    city: input.city,
    province: input.province,
    employeeTarget: input.employeeTarget,
  });
  return String(row.id);
}

export async function getEmployerForUser(uid: string): Promise<EmployerOrg | null> {
  const rows = await djangoListMyEmployers();
  if (!rows.length) return null;
  return mapEmployer(rows[0] as Record<string, unknown>, uid);
}

export async function listEmployerEnrollments(employerId: string): Promise<EmployeeEnrollment[]> {
  if (!employerId || !isDjangoApiEnabled()) return [];
  const rows = await djangoListEmployerEnrollments(employerId);
  return rows.map((row) => mapEnrollment(row, employerId));
}

export async function addEmployeeEnrollment(
  employerId: string,
  email: string,
  displayName?: string,
): Promise<void> {
  if (!isDjangoApiEnabled()) {
    throw new Error('Employee enrollment requires the Anixi API.');
  }
  await djangoAddEmployerEnrollment(employerId, { email, displayName });
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
