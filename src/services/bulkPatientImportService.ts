import { djangoImportRoster, isDjangoApiEnabled } from './djangoApiService';

export type BulkPatientRow = {
  displayName: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  chartId?: string;
  patientExternalId?: string;
  mrn?: string;
};

export type BulkPatientResult = {
  displayName: string;
  email?: string;
  success: boolean;
  patientId?: string;
  error?: string;
  inviteQueued?: boolean;
  /** Per-patient code for activating a clinic-uploaded account in the mobile app */
  activationCode?: string;
  /** Deep link patients can use to activate instead of creating a duplicate account */
  activationLink?: string;
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
  'gender',
  'chart_id',
  'mrn',
] as const;

const TEMPLATE_ROWS = [
  PATIENT_IMPORT_CSV_HEADERS.join(','),
  'Thabo Mokoena,thabo@example.co.za,+27821234567,1990-05-12,Male,,',
  'Sarah Jones,sarah@example.co.za,+27829876543,1985-11-03,Female,,',
  'Sipho Dlamini,,+27831112222,1978-02-20,Male,CHT-0041,MRN-5501',
  'Nomsa Khumalo,,,1982-07-15,Female,CHT-0099,MRN-8820',
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
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
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

/**
 * Try to find a header index by checking multiple common synonyms.
 * Returns -1 if none found.
 */
function findHeaderIndex(headers: string[], synonyms: string[]): number {
  for (const syn of synonyms) {
    const idx = headers.indexOf(syn);
    if (idx !== -1) return idx;
  }
  for (const syn of synonyms) {
    // "name" matches last_name/first_name; require an exact synonym instead.
    if (syn === 'name' || syn === 'id') continue;
    const idx = headers.findIndex((h) => h === syn || h.endsWith(`_${syn}`));
    if (idx !== -1) return idx;
  }
  return -1;
}

function buildDisplayName(parts: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  generalName?: string;
}): string {
  // If a "full_name" column exists and has a value, prefer it
  if (parts.fullName?.trim()) return parts.fullName.trim();

  const nameParts = [parts.firstName, parts.middleName, parts.lastName]
    .map((p) => p?.trim())
    .filter(Boolean);
  if (nameParts.length) return nameParts.join(' ');

  // Fallback: "Patient General" column
  if (parts.generalName?.trim()) return parts.generalName.trim();

  return '';
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

  // Auto-detect header row: if any header looks like a known column name
  const KNOWN_HEADERS = [
    'full_name', 'name', 'email', 'phone', 'date_of_birth', 'dob',
    'first_name', 'last_name', 'gender', 'chart_id', 'mrn',
    'patient_general', 'patient_last_name', 'patient_first_name',
    'patient_birth_date', 'patient_gender', 'patient_id', 'patient_mrn',
  ];
  const hasHeader = headerCells.some((h) => KNOWN_HEADERS.includes(h));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Resolve column indices with synonym mappings
  const fullNameIdx = findHeaderIndex(headerCells, ['full_name', 'display_name', 'patient_name', 'name']);
  const firstNameIdx = findHeaderIndex(headerCells, ['patient_first_name', 'first_name', 'firstname']);
  const lastNameIdx = findHeaderIndex(headerCells, ['patient_last_name', 'last_name', 'lastname', 'surname']);
  const middleNameIdx = findHeaderIndex(headerCells, ['patient_middle_name', 'middle_name', 'middle_initial']);
  const generalNameIdx = findHeaderIndex(headerCells, ['patient_general']);
  const emailIdx = findHeaderIndex(headerCells, ['email', 'patient_email', 'e_mail']);
  const phoneIdx = findHeaderIndex(headerCells, ['phone', 'phone_number', 'telephone', 'cell', 'mobile']);
  const dobIdx = findHeaderIndex(headerCells, ['date_of_birth', 'dob', 'birth_date', 'patient_birth_date']);
  const genderIdx = findHeaderIndex(headerCells, ['gender', 'sex', 'patient_gender']);
  const chartIdIdx = findHeaderIndex(headerCells, ['chart_id', 'chart_number']);
  const patientIdIdx = findHeaderIndex(headerCells, ['patient_id', 'external_id']);
  const mrnIdx = findHeaderIndex(headerCells, ['mrn', 'patient_mrn', 'medical_record_number']);
  // If no header row detected, use positional defaults matching our template
  const usePositional = !hasHeader;
  const pFullNameIdx = usePositional ? 0 : fullNameIdx;
  const pEmailIdx = usePositional ? 1 : emailIdx;
  const pPhoneIdx = usePositional ? 2 : phoneIdx;
  const pDobIdx = usePositional ? 3 : dobIdx;

  const rows: BulkPatientRow[] = [];
  const issues: BulkParseIssue[] = [];

  dataLines.forEach((line, index) => {
    const lineNumber = hasHeader ? index + 2 : index + 1;
    const cells = splitCsvLine(line);

    const fullName = pFullNameIdx >= 0 ? cells[pFullNameIdx] : undefined;
    const firstName = firstNameIdx >= 0 ? cells[firstNameIdx] : undefined;
    const lastName = lastNameIdx >= 0 ? cells[lastNameIdx] : undefined;
    const middleName = middleNameIdx >= 0 ? cells[middleNameIdx] : undefined;
    const generalName = generalNameIdx >= 0 ? cells[generalNameIdx] : undefined;

    const displayName = buildDisplayName({ fullName, firstName, lastName, middleName, generalName });

    if (!displayName) {
      issues.push({ line: lineNumber, message: 'Missing patient name.' });
      return;
    }

    const email = pEmailIdx >= 0 ? (cells[pEmailIdx] || '').trim().toLowerCase() : '';
    const phone = pPhoneIdx >= 0 ? (cells[pPhoneIdx] || '').trim() : '';

    const chartId = chartIdIdx >= 0 ? (cells[chartIdIdx] || '').trim() : '';
    const patientExtId = patientIdIdx >= 0 ? (cells[patientIdIdx] || '').trim() : '';
    const mrn = mrnIdx >= 0 ? (cells[mrnIdx] || '').trim() : '';
    const dobRaw = pDobIdx >= 0 ? (cells[pDobIdx] || '').trim() : '';

    // Must have email, phone, clinic identifier, or DOB (name + DOB is enough)
    if (!email && !phone && !chartId && !mrn && !patientExtId && !dobRaw) {
      issues.push({
        line: lineNumber,
        message: `${displayName}: needs email, phone, MRN/chart ID, or date of birth.`,
      });
      return;
    }

    // Validate email if present
    if (email && !email.includes('@')) {
      issues.push({
        line: lineNumber,
        message: `${displayName}: invalid email "${email}".`,
      });
      return;
    }

    const genderRaw = genderIdx >= 0 ? (cells[genderIdx] || '').trim() : '';

    rows.push({
      displayName,
      firstName: firstName?.trim() || undefined,
      lastName: lastName?.trim() || undefined,
      middleName: middleName?.trim() || undefined,
      email: email || undefined,
      phoneNumber: phone || undefined,
      dateOfBirth: dobRaw || undefined,
      gender: genderRaw || undefined,
      chartId: chartId || undefined,
      patientExternalId: patientExtId || undefined,
      mrn: mrn || undefined,
    });
  });

  return { rows, issues };
}

/** @deprecated Use parsePatientBulkCsv for file uploads. */
export function parsePatientBulkInput(text: string): BulkPatientRow[] {
  return parsePatientBulkCsv(text).rows;
}

function buildActivationLink(activationCode: string): string {
  const base = process.env.REACT_APP_PATIENT_APP_URL || 'anixi://activate';
  if (base.startsWith('http')) {
    const url = new URL(base.endsWith('/') ? base : `${base}/`);
    url.searchParams.set('code', activationCode);
    return url.toString();
  }
  return `${base}?code=${encodeURIComponent(activationCode)}`;
}

export async function importPracticePatientsBulk(opts: {
  doctorId: string;
  practiceId: string;
  practiceName?: string;
  rows: BulkPatientRow[];
  sendAppInvites: boolean;
}): Promise<BulkPatientResult[]> {
  if (!isDjangoApiEnabled()) {
    return opts.rows.map((row) => ({
      displayName: row.displayName,
      email: row.email,
      success: false,
      error: 'Django API not configured',
    }));
  }

  try {
    const payload = opts.rows.map((row) => ({
      name: row.displayName,
      email: row.email?.trim() || '',
      phone: row.phoneNumber || '',
      dateOfBirth: row.dateOfBirth || '',
      mrn: row.mrn || '',
      chartId: row.chartId || row.patientExternalId || '',
      practiceId: opts.practiceId,
      notes: [
        row.gender ? `Gender: ${row.gender}` : '',
        row.chartId ? `Chart ID: ${row.chartId}` : '',
        row.patientExternalId ? `External ID: ${row.patientExternalId}` : '',
        row.mrn ? `MRN: ${row.mrn}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    }));

    const imported = await djangoImportRoster(payload, opts.practiceId);
    const importedByName = new Map(imported.rows.map((r) => [r.displayName.toLowerCase(), r]));

    return opts.rows.map((row) => {
      const match = importedByName.get(row.displayName.toLowerCase());
      if (!match) {
        return {
          displayName: row.displayName,
          email: row.email,
          success: false,
          error: 'Row was skipped during import (missing required fields)',
        };
      }

      const hasEmail = !!row.email?.trim();
      return {
        displayName: row.displayName,
        email: row.email,
        success: true,
        patientId: match.patientId,
        inviteQueued: hasEmail && opts.sendAppInvites,
        activationCode: match.activationCode,
        activationLink: buildActivationLink(match.activationCode),
      };
    });
  } catch (err) {
    return opts.rows.map((row) => ({
      displayName: row.displayName,
      email: row.email,
      success: false,
      error: err instanceof Error ? err.message : 'Import failed',
    }));
  }
}
