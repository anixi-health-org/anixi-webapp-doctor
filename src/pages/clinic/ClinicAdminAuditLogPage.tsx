import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import {
  auditActionLabel,
  listClinicAuditLogs,
} from '../../services/clinicAuditService';
import type { ClinicAuditLogEntry } from '../../types';

function formatWhen(date: Date): string {
  return date.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ClinicAdminAuditLogPage: React.FC = () => {
  const { practiceSession } = useAuth();
  const practiceId = practiceSession?.practice?.id;
  const [entries, setEntries] = useState<ClinicAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listClinicAuditLogs(practiceId);
      setEntries(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit log';
      setError(message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [practiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Audit log"
        description="Append-only record of clinic admin actions for compliance and oversight."
      />

      {error ? (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-[#65758b]">Loading audit log…</p>
      ) : entries.length === 0 ? (
        <p className="mt-6 text-sm text-[#65758b]">
          No audit events yet. Actions on the queue, team, and billing will appear here.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f6]">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-[#65758b]">
                    {formatWhen(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3">{auditActionLabel(entry.action)}</td>
                  <td className="px-4 py-3">{entry.summary}</td>
                  <td className="px-4 py-3">{entry.actorName ?? entry.actorUid.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
};

export default ClinicAdminAuditLogPage;
