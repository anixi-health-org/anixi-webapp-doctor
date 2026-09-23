import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowsUpDownIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import { usePartnerListing } from '../../components/PartnerLayout';
import {
  PartnerFlash,
  PartnerMarketPreview,
  partnerFieldClass,
  partnerHelpClass,
  partnerLabelClass,
} from '../../components/partner/partnerUi';
import type { PartnerOffering } from '../../services/djangoApiService';

type Draft = PartnerOffering & { key: string };

function newDraft(seed?: Partial<PartnerOffering>): Draft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: seed?.name || '',
    description: seed?.description || '',
    price: seed?.price || '',
  };
}

export const PartnerOfferingsPage: React.FC = () => {
  const { listing, loading, error, save } = usePartnerListing();
  const [rows, setRows] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (listing?.offerings) {
      setRows(
        listing.offerings.length
          ? listing.offerings.map((o) =>
              newDraft({
                name: o.name || '',
                description: o.description || '',
                price: o.price || '',
              }),
            )
          : [],
      );
      setDirty(false);
    }
  }, [listing]);

  const updateRow = (key: string, patch: Partial<PartnerOffering>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setDirty(true);
  };

  const addRow = () => {
    setRows((prev) => [...prev, newDraft()]);
    setDirty(true);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
    setDirty(true);
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
    setDirty(true);
  };

  const cleaned = useMemo(
    () =>
      rows
        .map((r) => ({
          name: (r.name || '').trim(),
          description: (r.description || '').trim(),
          price: (r.price || '').trim() || null,
        }))
        .filter((r) => r.name),
    [rows],
  );

  const livePreview = useMemo(() => {
    if (!listing) return null;
    return { ...listing, offerings: cleaned };
  }, [listing, cleaned]);

  const onSave = async () => {
    if (!listing || saving) return;
    const emptyNames = rows.some((r) => !(r.name || '').trim() && ((r.description || '').trim() || (r.price || '').trim()));
    if (emptyNames) {
      setMessageType('err');
      setMessage('Every offering needs a name, or clear the empty row.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await save({ offerings: cleaned });
      setDirty(false);
      setMessageType('ok');
      setMessage(
        cleaned.length
          ? `${cleaned.length} offering${cleaned.length === 1 ? '' : 's'} saved to your Market listing.`
          : 'Offerings cleared. Add at least one so patients know what you provide.',
      );
    } catch (err) {
      setMessageType('err');
      setMessage(err instanceof Error ? err.message : 'Could not save offerings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell maxWidth="wide" className="py-6 sm:py-8">
        <div className="h-40 animate-pulse rounded-2xl bg-[#dfe6e1]" />
      </PageShell>
    );
  }

  if (error || !listing) {
    return (
      <PageShell maxWidth="wide" className="py-6 sm:py-8">
        <PageHeader title="Offerings" description={error || 'Unavailable'} />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Offerings"
        description={
          listing.partnerType === 'pharmacy'
            ? 'Medications, delivery options, and services patients associate with your pharmacy.'
            : 'Services and packages patients can expect from your wellness practice.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {dirty ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                Unsaved changes
              </span>
            ) : null}
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-2 rounded-full border border-[#d9e0da] bg-white px-4 py-2 text-sm font-semibold text-[#344256] hover:border-anixi-green/40"
            >
              <PlusIcon className="h-4 w-4" />
              Add offering
            </button>
          </div>
        }
      />

      <PartnerFlash message={message} tone={messageType} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d9e0da] bg-white px-6 py-14 text-center shadow-soft">
              <p className="font-heading text-lg font-bold text-[#344256]">No offerings yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#65758b]">
                Add the products or services patients should see on your Market detail page. Include
                a price when it helps them decide.
              </p>
              <button
                type="button"
                onClick={addRow}
                className="mt-5 inline-flex rounded-full bg-anixi-green px-4 py-2.5 text-sm font-semibold text-white"
              >
                Add first offering
              </button>
            </div>
          ) : (
            rows.map((row, index) => (
              <div
                key={row.key}
                className="rounded-2xl border border-[#e1e7ef] bg-white p-4 shadow-soft sm:p-5"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                    Offering {index + 1}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveRow(index, -1)}
                      disabled={index === 0}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#65758b] hover:bg-[#f4f6f5] disabled:opacity-40"
                      title="Move up"
                    >
                      <ArrowsUpDownIcon className="h-3.5 w-3.5" />
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRow(index, 1)}
                      disabled={index === rows.length - 1}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#65758b] hover:bg-[#f4f6f5] disabled:opacity-40"
                      title="Move down"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label className={partnerLabelClass}>Name</label>
                    <input
                      className={partnerFieldClass}
                      value={row.name}
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                      placeholder={
                        listing.partnerType === 'pharmacy'
                          ? 'e.g. Same-day script delivery'
                          : 'e.g. 4-week nutrition plan'
                      }
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={partnerLabelClass}>Price</label>
                    <input
                      className={partnerFieldClass}
                      value={row.price || ''}
                      onChange={(e) => updateRow(row.key, { price: e.target.value })}
                      placeholder="e.g. R120 · From R450 · Free consult"
                    />
                    <p className={partnerHelpClass}>Optional — leave blank if price varies</p>
                  </div>
                  <div className="sm:col-span-6">
                    <label className={partnerLabelClass}>Description</label>
                    <textarea
                      className={`${partnerFieldClass} min-h-[88px]`}
                      value={row.description || ''}
                      onChange={(e) => updateRow(row.key, { description: e.target.value })}
                      placeholder="What is included, who it is for, and how patients start"
                    />
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-sm text-[#65758b]">
              {cleaned.length} ready to publish ·{' '}
              <Link to="/partner/listing" className="font-semibold text-anixi-green hover:underline">
                Edit listing profile
              </Link>
            </p>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || !dirty}
              className="inline-flex rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save offerings'}
            </button>
          </div>
        </div>

        <aside className="lg:col-span-2">
          <div className="lg:sticky lg:top-24 space-y-4">
            {livePreview ? <PartnerMarketPreview listing={livePreview} /> : null}
            <div className="rounded-2xl border border-[#e1e7ef] bg-white p-4 text-sm text-[#65758b] shadow-soft">
              <p className="font-semibold text-[#344256]">Offering tips</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Lead with the outcome (“Same-day delivery”, not “Service 1”)</li>
                <li>Put your most popular offering first</li>
                <li>Use local currency (R) so patients recognise pricing</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
};
