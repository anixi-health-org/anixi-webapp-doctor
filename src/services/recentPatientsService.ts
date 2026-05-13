const STORAGE_KEY = 'anixi_recent_patients';
const MAX_RECENT = 10;

export interface RecentPatientEntry {
  patientId: string;
  patientName: string;
  email?: string;
  visitedAt: number; // unix ms
}

export function recordPatientVisit(
  patientId: string,
  patientName: string,
  email?: string
): void {
  try {
    const existing = getRecentPatients().filter((p) => p.patientId !== patientId);
    const updated: RecentPatientEntry[] = [
      { patientId, patientName, email, visitedAt: Date.now() },
      ...existing,
    ].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable in some environments; fail silently
  }
}

export function getRecentPatients(): RecentPatientEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentPatientEntry[];
  } catch {
    return [];
  }
}

export function clearRecentPatients(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fail silently
  }
}
