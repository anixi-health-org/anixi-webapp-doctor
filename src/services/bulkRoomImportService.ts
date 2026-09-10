import type { Practice, PracticeLocation, PracticeRoom } from '../types';
import { addPracticeRoomsBulk } from './roomService';

export type BulkRoomRow = {
  name: string;
  type: PracticeRoom['type'];
  locationName?: string;
  locationId?: string;
  capacity?: number;
};

export type BulkRoomResult = {
  name: string;
  success: boolean;
  error?: string;
  skippedDuplicate?: boolean;
};

export type BulkParseIssue = {
  line: number;
  message: string;
};

export const ROOM_IMPORT_CSV_HEADERS = ['room_name', 'type', 'location', 'capacity'] as const;

const TEMPLATE_ROWS = [
  ROOM_IMPORT_CSV_HEADERS.join(','),
  'Consult Room 1,consult,Main branch,',
  'Procedure Room A,procedure,Main branch,1',
  'Virtual Suite,virtual,,',
  'Waiting Area,other,,',
].join('\n');

const VALID_TYPES = new Set<PracticeRoom['type']>(['consult', 'procedure', 'virtual', 'other']);

const TYPE_SYNONYMS: Record<string, PracticeRoom['type']> = {
  consult: 'consult',
  consultation: 'consult',
  consulting: 'consult',
  exam: 'consult',
  procedure: 'procedure',
  surgery: 'procedure',
  treatment: 'procedure',
  virtual: 'virtual',
  telehealth: 'virtual',
  teleconsult: 'virtual',
  video: 'virtual',
  other: 'other',
  waiting: 'other',
  reception: 'other',
};

export function downloadRoomImportTemplate(): void {
  const blob = new Blob([`${TEMPLATE_ROWS}\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'anixi-clinic-rooms-template.csv';
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

function findHeaderIndex(headers: string[], synonyms: string[]): number {
  for (const syn of synonyms) {
    const idx = headers.indexOf(syn);
    if (idx !== -1) return idx;
  }
  return headers.findIndex((h) => synonyms.some((syn) => h.includes(syn)));
}

function normalizeRoomType(raw: string): PracticeRoom['type'] | null {
  const key = raw.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!key) return 'consult';
  const mapped = TYPE_SYNONYMS[key];
  if (mapped) return mapped;
  if (VALID_TYPES.has(key as PracticeRoom['type'])) return key as PracticeRoom['type'];
  return null;
}

export function resolveLocationId(
  locations: PracticeLocation[],
  locationRaw: string,
): { locationId?: string; issue?: string } {
  const needle = locationRaw.trim();
  if (!needle) return {};

  const byId = locations.find((loc) => loc.id === needle);
  if (byId) return { locationId: byId.id };

  const lower = needle.toLowerCase();
  const byName = locations.find((loc) => loc.name.trim().toLowerCase() === lower);
  if (byName) return { locationId: byName.id };

  return { issue: `Unknown location "${needle}" — use a clinic location name or leave blank.` };
}

export function parseRoomBulkCsv(
  text: string,
  locations: PracticeLocation[] = [],
): { rows: BulkRoomRow[]; issues: BulkParseIssue[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], issues: [{ line: 0, message: 'The file is empty.' }] };
  }

  const headerCells = splitCsvLine(lines[0]).map(normalizeHeader);
  const knownHeaders = [
    'room_name', 'name', 'room', 'type', 'room_type', 'location', 'location_name', 'capacity',
  ];
  const hasHeader = headerCells.some((h) => knownHeaders.includes(h));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const nameIdx = findHeaderIndex(headerCells, ['room_name', 'room', 'name']);
  const typeIdx = findHeaderIndex(headerCells, ['type', 'room_type']);
  const locationIdx = findHeaderIndex(headerCells, ['location', 'location_name']);
  const capacityIdx = findHeaderIndex(headerCells, ['capacity']);

  const usePositional = !hasHeader;
  const pNameIdx = usePositional ? 0 : nameIdx;
  const pTypeIdx = usePositional ? 1 : typeIdx;
  const pLocationIdx = usePositional ? 2 : locationIdx;
  const pCapacityIdx = usePositional ? 3 : capacityIdx;

  const rows: BulkRoomRow[] = [];
  const issues: BulkParseIssue[] = [];

  dataLines.forEach((line, index) => {
    const lineNumber = hasHeader ? index + 2 : index + 1;
    const cells = splitCsvLine(line);
    const name = pNameIdx >= 0 ? (cells[pNameIdx] || '').trim() : '';

    if (!name) {
      issues.push({ line: lineNumber, message: 'Missing room name.' });
      return;
    }

    const typeRaw = pTypeIdx >= 0 ? (cells[pTypeIdx] || '').trim() : 'consult';
    const roomType = normalizeRoomType(typeRaw || 'consult');
    if (!roomType) {
      issues.push({
        line: lineNumber,
        message: `${name}: invalid type "${typeRaw}" (use consult, procedure, virtual, or other).`,
      });
      return;
    }

    const locationRaw = pLocationIdx >= 0 ? (cells[pLocationIdx] || '').trim() : '';
    const locationMatch = resolveLocationId(locations, locationRaw);
    if (locationMatch.issue) {
      issues.push({ line: lineNumber, message: `${name}: ${locationMatch.issue}` });
      return;
    }

    const capacityRaw = pCapacityIdx >= 0 ? (cells[pCapacityIdx] || '').trim() : '';
    let capacity: number | undefined;
    if (capacityRaw) {
      const parsed = Number(capacityRaw);
      if (!Number.isFinite(parsed) || parsed < 1) {
        issues.push({ line: lineNumber, message: `${name}: capacity must be a positive number.` });
        return;
      }
      capacity = Math.floor(parsed);
    }

    rows.push({
      name,
      type: roomType,
      locationName: locationRaw || undefined,
      locationId: locationMatch.locationId,
      capacity,
    });
  });

  return { rows, issues };
}

export async function importPracticeRoomsBulk(opts: {
  practice: Practice;
  rows: BulkRoomRow[];
}): Promise<BulkRoomResult[]> {
  return addPracticeRoomsBulk(opts.practice, opts.rows);
}
