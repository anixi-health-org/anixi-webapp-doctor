import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  buildClaimExportCsv,
  createClaimFromInvoice,
  listPracticeClaims,
  updateClaimStatus,
} from '../../services/claimService';
import { getInvoicesForPractice } from '../../services/invoiceService';
import { listPracticePatients } from '../../services/practicePatientService';
import { listPracticeClinicians } from '../../services/practiceSettingsService';
import type { Invoice, MedicalAidClaim, Patient } from '../../types';

export const ClinicAdminClaimsPage: React.FC = () => {
  const { practiceSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const [claims, setClaims] = useState<MedicalAidClaim[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const canManage = can('viewBilling');

  const load = useCallback(async () => {
    if (!practice?.id) return;
    setLoading(true);
    try {
      const [claimRows, invoiceRows, patientRows] = await Promise.all([
        listPracticeClaims(practice.id),
        getInvoicesForPractice(
          practice.id,
          (await listPracticeClinicians(practice.id)).map((c) => c.uid),
        ),
        listPracticePatients(practice.id),
      ]);
      setClaims(claimRows);
      setInvoices(invoiceRows);
      setPatients(patientRows);
    } finally {
      setLoading(false);
    }
  }, [practice?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const patientById = useMemo(() => {
    const map = new Map<string, Patient>();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  const claimByInvoice = useMemo(() => {
    const map = new Map<string, MedicalAidClaim>();
    claims.forEach((c) => map.set(c.invoiceId, c));
    return map;
  }, [claims]);

  const handleCreate = async (invoice: Invoice) => {
    setCreatingFor(invoice.id);
    try {
      await createClaimFromInvoice(invoice, patientById.get(invoice.patientId) ?? null);
      await load();
    } finally {
      setCreatingFor(null);
    }
  };

  const handleSubmit = async (claimId: string) => {
    await updateClaimStatus(claimId, 'submitted');
    await load();
  };

  const handleExport = (claim: MedicalAidClaim) => {
    const csv = buildClaimExportCsv(claim);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `claim-${claim.invoiceNumber || claim.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!practice) return null;

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Medical aid claims"
        description="Prepare claim packs from invoices. Export CSV for your switch or scheme portal."
      />

      {!canManage ? (
        <p className="mt-6 text-sm text-[#65758b]">
          You don&apos;t have billing permission to manage claims.
        </p>
      ) : loading ? (
        <p className="mt-6 text-sm text-[#65758b]">Loading claims…</p>
      ) : (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#344256]">Claims</h2>
            {claims.length === 0 ? (
              <p className="text-sm text-[#65758b]">No claims yet. Create one from an invoice below.</p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Scheme</th>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef2f6]">
                    {claims.map((claim) => (
                      <tr key={claim.id}>
                        <td className="px-4 py-3">{claim.invoiceNumber || claim.invoiceId}</td>
                        <td className="px-4 py-3">{claim.medicalSchemeName || '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{claim.memberNumber || '-'}</td>
                        <td className="px-4 py-3 capitalize">{claim.status.replace('_', ' ')}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleExport(claim)}
                              className="rounded-lg border border-[#e1e7ef] px-3 py-1 text-xs font-semibold text-[#344256]"
                            >
                              Export CSV
                            </button>
                            {claim.status === 'draft' ? (
                              <button
                                type="button"
                                onClick={() => void handleSubmit(claim.id)}
                                className="rounded-lg bg-[#1a4d4d] px-3 py-1 text-xs font-semibold text-white"
                              >
                                Mark submitted
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#344256]">Create from invoice</h2>
            <div className="overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f6]">
                  {invoices.slice(0, 20).map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-3">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        {patientById.get(invoice.patientId)?.displayName || invoice.patientId}
                      </td>
                      <td className="px-4 py-3">
                        R {invoice.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {claimByInvoice.has(invoice.id) ? (
                          <span className="text-xs text-[#65758b]">Claim exists</span>
                        ) : (
                          <button
                            type="button"
                            disabled={creatingFor === invoice.id}
                            onClick={() => void handleCreate(invoice)}
                            className="rounded-lg bg-[#1a4d4d] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {creatingFor === invoice.id ? 'Creating…' : 'Create claim'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
};

export default ClinicAdminClaimsPage;
