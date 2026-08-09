import { createPracticeInvite, type CreatePracticeInviteInput } from './practiceInviteService';
import type { PracticeRole } from '../types';
import { INVITABLE_ROLES, permissionsForRole } from '../lib/practiceRoles';

export type BulkDoctorRow = {
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  role: PracticeRole;
  phone?: string;
  hpcsaNumber?: string;
};

export type BulkInviteResult = {
  email: string;
  success: boolean;
  error?: string;
};

export type BulkParseIssue = {
  line: number;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES: PracticeRole[] = [...INVITABLE_ROLES];

export const DOCTOR_INVITE_CSV_HEADERS = [
  'email',
  'first_name',
  'last_name',
  'role',
  'phone',
  'hpcsa_number',
] as const;

const TEMPLATE_ROWS = [
  DOCTOR_INVITE_CSV_HEADERS.join(','),
  'dr.smith@example.co.za,John,Smith,doctor,+27821234567,MP1234567',
  'jane.doe@example.co.za,Jane,Doe,receptionist,+27829876543,',
  'billing@example.co.za,Sipho,Nkosi,billing_clerk,+27831112222,',
].join('\n');

export const DOCTOR_INVITE_ROLE_HINT =
  'doctor, practice_manager, receptionist, billing_clerk';

/** Trigger download of the standard clinic staff CSV template. */
export function downloadDoctorInviteTemplate(): void {
  const blob = new Blob([`${TEMPLATE_ROWS}\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'anixi-clinic-staff-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Parse a single CSV line respecting quoted fields. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function resolveRole(raw: string | undefined, defaultRole: PracticeRole): PracticeRole | null {
  const normalized = (raw || defaultRole).toLowerCase().replace(/\s+/g, '_') as PracticeRole;
  return ALLOWED_ROLES.includes(normalized) ? normalized : null;
}

function buildDisplayName(firstName?: string, lastName?: string, fallback?: string): string | undefined {
  const parts = [firstName, lastName].map((p) => p?.trim()).filter(Boolean);
  if (parts.length) return parts.join(' ');
  return fallback?.trim() || undefined;
}

export function parseDoctorBulkCsv(
  text: string,
  defaultRole: PracticeRole = 'doctor'
): { rows: BulkDoctorRow[]; issues: BulkParseIssue[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], issues: [{ line: 0, message: 'The file is empty.' }] };
  }

  const headerCells = splitCsvLine(lines[0]).map(normalizeHeader);
  const hasHeader = headerCells.includes('email');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const emailIdx = hasHeader ? headerCells.indexOf('email') : 0;
  const firstNameIdx = hasHeader ? headerCells.indexOf('first_name') : 1;
  const lastNameIdx = hasHeader ? headerCells.indexOf('last_name') : 2;
  const roleIdx = hasHeader ? headerCells.indexOf('role') : 3;
  const phoneIdx = hasHeader ? headerCells.indexOf('phone') : 4;
  const hpcsaIdx = hasHeader ? headerCells.indexOf('hpcsa_number') : 5;

  const rows: BulkDoctorRow[] = [];
  const issues: BulkParseIssue[] = [];
  const seen = new Set<string>();

  dataLines.forEach((line, index) => {
    const lineNumber = hasHeader ? index + 2 : index + 1;
    const cells = splitCsvLine(line);
    const email = (cells[emailIdx] || cells[0] || '').toLowerCase().trim();

    if (!email) {
      issues.push({ line: lineNumber, message: 'Missing email address.' });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      issues.push({ line: lineNumber, message: `Invalid email: ${email}` });
      return;
    }
    if (seen.has(email)) {
      issues.push({ line: lineNumber, message: `Duplicate email: ${email}` });
      return;
    }

    const firstName = firstNameIdx >= 0 ? cells[firstNameIdx] : undefined;
    const lastName = lastNameIdx >= 0 ? cells[lastNameIdx] : undefined;
    const roleRaw = roleIdx >= 0 ? cells[roleIdx] : undefined;
    const role = resolveRole(roleRaw, defaultRole);

    if (!role) {
      issues.push({
        line: lineNumber,
        message: `Invalid role "${roleRaw || ''}". Use: ${DOCTOR_INVITE_ROLE_HINT}`,
      });
      return;
    }

    seen.add(email);
    rows.push({
      email,
      firstName,
      lastName,
      displayName: buildDisplayName(firstName, lastName, cells[1]),
      role,
      phone: phoneIdx >= 0 ? cells[phoneIdx] || undefined : undefined,
      hpcsaNumber: hpcsaIdx >= 0 ? cells[hpcsaIdx] || undefined : undefined,
    });
  });

  return { rows, issues };
}

/** @deprecated Use parseDoctorBulkCsv for file uploads. */
export function parseDoctorBulkInput(text: string, defaultRole: PracticeRole = 'doctor'): BulkDoctorRow[] {
  return parseDoctorBulkCsv(text, defaultRole).rows;
}

export async function createPracticeInvitesBulk(
  base: Omit<CreatePracticeInviteInput, 'email' | 'displayName' | 'role' | 'permissions'>,
  rows: BulkDoctorRow[]
): Promise<BulkInviteResult[]> {
  const results: BulkInviteResult[] = [];

  for (const row of rows) {
    try {
      await createPracticeInvite({
        ...base,
        email: row.email,
        displayName: row.displayName,
        role: row.role,
        permissions: permissionsForRole(row.role),
        phone: row.phone,
        hpcsaRegistrationNumber: row.hpcsaNumber,
      });
      results.push({ email: row.email, success: true });
    } catch (err) {
      results.push({
        email: row.email,
        success: false,
        error: err instanceof Error ? err.message : 'Invite failed',
      });
    }
  }

  return results;
}
