import { addPatientManually } from './patientManagementService';

export type BulkPatientRow = {
  displayName: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
};

export type BulkPatientResult = {
  displayName: string;
  email?: string;
  success: boolean;
  patientId?: string;
  error?: string;
  inviteQueued?: boolean;
};

export type BulkParseIssue = {
  line: number;
  message: string;
};

export const PATIENT_IMPORT_CSV_HEADERS = [
  'full_name',
  'email',
  'phone',
  'date_of_birth',
] as const;

const TEMPLATE_ROWS = [
  PATIENT_IMPORT_CSV_HEADERS.join(','),
  'Thabo Mokoena,thabo@example.co.za,+27821234567,1990-05-12',
  'Sarah Jones,sarah@example.co.za,+27829876543,1985-11-03',
].join('\n');

/** Trigger download of the standard patient roster CSV template. */
export function downloadPatientImportTemplate(): void {
  const blob = new Blob([`${TEMPLATE_ROWS}\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'anixi-clinic-patients-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

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

export function parsePatientBulkCsv(text: string): {
  rows: BulkPatientRow[];
  issues: BulkParseIssue[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], issues: [{ line: 0, message: 'The file is empty.' }] };
  }

  const headerCells = splitCsvLine(lines[0]).map(normalizeHeader);
  const hasHeader =
    headerCells.includes('full_name') ||
    headerCells.includes('name') ||
    headerCells.includes('email');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const nameIdx = hasHeader
    ? Math.max(headerCells.indexOf('full_name'), headerCells.indexOf('name'))
    : 0;
  const emailIdx = hasHeader ? headerCells.indexOf('email') : 1;
  const phoneIdx = hasHeader ? headerCells.indexOf('phone') : 2;
  const dobIdx = hasHeader ? headerCells.indexOf('date_of_birth') : 3;

  const rows: BulkPatientRow[] = [];
  const issues: BulkParseIssue[] = [];

  dataLines.forEach((line, index) => {
    const lineNumber = hasHeader ? index + 2 : index + 1;
    const cells = splitCsvLine(line);
    const displayName = (nameIdx >= 0 ? cells[nameIdx] : cells[0])?.trim();

    if (!displayName) {
      issues.push({ line: lineNumber, message: 'Missing patient name.' });
      return;
    }

    const email = (emailIdx >= 0 ? cells[emailIdx] : cells[1])?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      issues.push({
        line: lineNumber,
        message: 'Email is required so patients receive app login details.',
      });
      return;
    }

    rows.push({
      displayName,
      email,
      phoneNumber: phoneIdx >= 0 ? cells[phoneIdx] || undefined : undefined,
      dateOfBirth: dobIdx >= 0 ? cells[dobIdx] || undefined : undefined,
    });
  });

  return { rows, issues };
}

/** @deprecated Use parsePatientBulkCsv for file uploads. */
export function parsePatientBulkInput(text: string): BulkPatientRow[] {
  return parsePatientBulkCsv(text).rows;
}

export async function importPracticePatientsBulk(opts: {
  doctorId: string;
  practiceId: string;
  practiceName?: string;
  rows: BulkPatientRow[];
  sendAppInvites: boolean;
}): Promise<BulkPatientResult[]> {
  const results: BulkPatientResult[] = [];

  for (const row of opts.rows) {
    if (!opts.sendAppInvites || !row.email?.trim()) {
      results.push({
        displayName: row.displayName,
        email: row.email,
        success: false,
        error: 'Email is required for patient login provisioning.',
      });
      continue;
    }

    try {
      const created = await addPatientManually(
        opts.doctorId,
        {
          displayName: row.displayName,
          email: row.email.trim(),
          phoneNumber: row.phoneNumber,
          practiceId: opts.practiceId,
        },
        { sendInvite: true, inviteEmail: row.email.trim() }
      );
      results.push({
        displayName: row.displayName,
        email: row.email,
        success: true,
        patientId: created.patientId,
        inviteQueued: created.inviteQueued,
      });
    } catch (err) {
      results.push({
        displayName: row.displayName,
        email: row.email,
        success: false,
        error: err instanceof Error ? err.message : 'Import failed',
      });
    }
  }

  return results;
}
