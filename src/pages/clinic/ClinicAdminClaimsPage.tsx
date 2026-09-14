import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, PageShell } from '../../components/page-layout';
import { useAuth } from '../../hooks/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { COMMON_ICD10_CODES } from '../../lib/southAfrica';
import {
  buildClaimExportCsv,
  createClaimFromInvoice,
  listPracticeClaims,
  updateClaimDetails,
  updateClaimStatus,
} from '../../services/claimService';
import { getInvoicesForPractice } from '../../services/invoiceService';
import type { Invoice, MedicalAidClaim } from '../../types';

type ClaimForm = {
  invoiceId: string;
  medicalSchemeName: string;
  memberNumber: string;
  planOption: string;
  diagnosisCodes: string;
  notes: string;
};

const emptyForm: ClaimForm = {
  invoiceId: '',
  medicalSchemeName: '',
  memberNumber: '',
  planOption: '',
  diagnosisCodes: '',
  notes: '',
};

function parseDiagnosisCodes(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((code) => code.trim())
    .filter(Boolean);
}

export const ClinicAdminClaimsPage: React.FC = () => {
  const { practiceSession } = useAuth();
  const { can } = usePermissions();
  const practice = practiceSession?.practice;
  const [claims, setClaims] = useState<MedicalAidClaim[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ClaimForm>(emptyForm);
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);

  const canManage = can('viewBilling');

  const load = useCallback(async () => {
    if (!practice?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [claimRows, invoiceRows] = await Promise.all([
        listPracticeClaims(practice.id),
        getInvoicesForPractice(practice.id),
      ]);
      setClaims(claimRows);
      setInvoices(invoiceRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load claims.');
      setClaims([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [practice?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const claimByInvoice = useMemo(() => {
    const map = new Map<string, MedicalAidClaim>();
    claims.forEach((c) => map.set(c.invoiceId, c));
    return map;
  }, [claims]);

  const selectedInvoice = invoices.find((invoice) => invoice.id === form.invoiceId) ?? null;

  const openCreate = (invoice: Invoice) => {
    setEditingClaimId(null);
    setError(null);
    setForm({
      invoiceId: invoice.id,
      medicalSchemeName: '',
      memberNumber: '',
      planOption: '',
      diagnosisCodes: (invoice.diagnosisCodes || []).join(', '),
      notes: '',
    });
  };

  const openEdit = (claim: MedicalAidClaim) => {
    setEditingClaimId(claim.id);
    setError(null);
    setForm({
      invoiceId: claim.invoiceId,
      medicalSchemeName: claim.medicalSchemeName || '',
      memberNumber: claim.memberNumber || '',
      planOption: claim.planOption || '',
      diagnosisCodes: (claim.diagnosisCodes || []).join(', '),
      notes: claim.notes || '',
    });
  };

  const handleSaveForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedInvoice && !editingClaimId) return;
    setSaving(true);
    setError(null);
    try {
      const details = {
        medicalSchemeName: form.medicalSchemeName,
        memberNumber: form.memberNumber,
        planOption: form.planOption,
        diagnosisCodes: parseDiagnosisCodes(form.diagnosisCodes),
        notes: form.notes,
      };
      if (editingClaimId) {
        await updateClaimDetails(editingClaimId, details);
      } else if (selectedInvoice) {
        await createClaimFromInvoice(selectedInvoice, details);
      }
      setForm(emptyForm);
      setEditingClaimId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save claim');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (claim: MedicalAidClaim) => {
    if (!claim.medicalSchemeName?.trim() || !claim.memberNumber?.trim()) {
      setError('Add scheme name and member number before submitting.');
      openEdit(claim);
      return;
    }
    await updateClaimStatus(claim.id, 'submitted');
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
        description="Clinic billing prepares scheme packs from practice invoices. Independent doctors handle their own claims from private practice billing."
      />

      {!canManage ? (
        <p className="mt-6 rounded-2xl border border-[#e1e7ef] bg-white p-5 text-sm text-[#65758b]">
          You don&apos;t have billing permission to manage claims.
        </p>
      ) : loading ? (
        <p className="mt-6 text-sm text-[#65758b]">Loading claims...</p>
      ) : (
        <div className="mt-8 space-y-8">
          {error ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {(form.invoiceId || editingClaimId) && (
            <form
              onSubmit={(event) => void handleSaveForm(event)}
              className="rounded-2xl border border-[#e1e7ef] bg-white p-5"
            >
              <h2 className="text-lg font-semibold text-[#344256]">
                {editingClaimId ? 'Edit claim' : 'New claim'}
              </h2>
              <p className="mt-1 text-sm text-[#65758b]">
                Invoice {selectedInvoice?.invoiceNumber || form.invoiceId}. Scheme and member
                number are required before the claim can be submitted.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-[#65758b]">
                  Medical scheme
                  <input
                    required
                    value={form.medicalSchemeName}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, medicalSchemeName: e.target.value }))
                    }
                    placeholder="Discovery, Bonitas, GEMS…"
                    className="mt-1 w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[#65758b]">
                  Member number
                  <input
                    required
                    value={form.memberNumber}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, memberNumber: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[#65758b]">
                  Plan option
                  <input
                    value={form.planOption}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, planOption: e.target.value }))
                    }
                    placeholder="Classic, KeyCare…"
                    className="mt-1 w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[#65758b]">
                  ICD-10 codes
                  <input
                    list="clinic-icd10"
                    value={form.diagnosisCodes}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, diagnosisCodes: e.target.value }))
                    }
                    placeholder="E11.9, I10"
                    className="mt-1 w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                  />
                </label>
                <datalist id="clinic-icd10">
                  {COMMON_ICD10_CODES.map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.description}
                    </option>
                  ))}
                </datalist>
                <label className="sm:col-span-2 text-xs font-medium text-[#65758b]">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-[#e1e7ef] px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#1a4d4d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editingClaimId ? 'Save claim' : 'Create claim'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyForm);
                    setEditingClaimId(null);
                    setError(null);
                  }}
                  className="rounded-lg border border-[#e1e7ef] px-4 py-2 text-sm font-semibold text-[#344256]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#344256]">Claims</h2>
            {claims.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#e1e7ef] bg-white px-5 py-10 text-center text-sm text-[#65758b]">
                No claims yet. Create one from an invoice below, or add invoices first.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#fafcfb] text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Scheme</th>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">ICD-10</th>
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
                        <td className="px-4 py-3 text-xs">
                          {(claim.diagnosisCodes || []).join(', ') || '-'}
                        </td>
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
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEdit(claim)}
                                  className="rounded-lg border border-[#e1e7ef] px-3 py-1 text-xs font-semibold text-[#344256]"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSubmit(claim)}
                                  className="rounded-lg bg-[#1a4d4d] px-3 py-1 text-xs font-semibold text-white"
                                >
                                  Mark submitted
                                </button>
                              </>
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
            {invoices.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#e1e7ef] bg-white px-5 py-10 text-center text-sm text-[#65758b]">
                No clinic invoices yet. Create invoices first, then prepare medical aid packs here.
              </p>
            ) : (
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
                        {invoice.patientName || 'Patient'}
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
                            onClick={() => openCreate(invoice)}
                            className="rounded-lg bg-[#1a4d4d] px-3 py-1 text-xs font-semibold text-white"
                          >
                            Create claim
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
};

export default ClinicAdminClaimsPage;
