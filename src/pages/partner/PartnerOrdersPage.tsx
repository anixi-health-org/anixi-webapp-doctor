import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../../components/page-layout';
import {
  PARTNER_ORDERS_UPDATED_EVENT,
  usePartnerListing,
} from '../../components/PartnerLayout';
import {
  ORDER_STATUS_OPTIONS,
  PartnerFlash,
  orderStatusClasses,
  orderStatusLabel,
  partnerFieldClass,
  partnerLabelClass,
} from '../../components/partner/partnerUi';
import {
  djangoGetPartnerOrder,
  djangoGetPartnerOrders,
  djangoUpdatePartnerOrderStatus,
  type PartnerOrder,
} from '../../services/djangoApiService';

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export const PartnerOrdersPage: React.FC = () => {
  const { listing, loading: listingLoading } = usePartnerListing();
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PartnerOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [flash, setFlash] = useState('');
  const [flashTone, setFlashTone] = useState<'ok' | 'err' | 'info'>('info');

  const loadOrders = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    setError('');
    try {
      const rows = await djangoGetPartnerOrders();
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders');
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (listingLoading) return;
    if (listing?.partnerType !== 'pharmacy') {
      setLoading(false);
      return;
    }
    void loadOrders();
  }, [listing?.partnerType, listingLoading, loadOrders]);

  useEffect(() => {
    const onOrdersUpdated = () => {
      void loadOrders({ quiet: true });
    };
    window.addEventListener(PARTNER_ORDERS_UPDATED_EVENT, onOrdersUpdated);
    return () => window.removeEventListener(PARTNER_ORDERS_UPDATED_EVENT, onOrdersUpdated);
  }, [loadOrders]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void djangoGetPartnerOrder(selectedId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((err) => {
        if (!cancelled) {
          setFlashTone('err');
          setFlash(err instanceof Error ? err.message : 'Could not open order');
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      const status = String(o.status || 'sent').toLowerCase();
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!q) return true;
      const hay = [o.patientName, o.doctorName, o.prescriptionText, o.status, o.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, query, statusFilter]);

  const counts = useMemo(() => {
    const all = orders.length;
    const open = orders.filter(
      (o) => !['dispensed', 'cancelled'].includes(String(o.status || '').toLowerCase()),
    ).length;
    return { all, open };
  }, [orders]);

  const updateStatus = async (status: string) => {
    if (!selectedId || updating) return;
    setUpdating(true);
    setFlash('');
    try {
      const updated = await djangoUpdatePartnerOrderStatus(selectedId, status);
      setDetail(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      setFlashTone('ok');
      setFlash(`Order marked as ${orderStatusLabel(status)}.`);
    } catch (err) {
      setFlashTone('err');
      setFlash(err instanceof Error ? err.message : 'Could not update status');
    } finally {
      setUpdating(false);
    }
  };

  if (!listingLoading && listing && listing.partnerType !== 'pharmacy') {
    return <Navigate to="/partner" replace />;
  }

  return (
    <PageShell maxWidth="wide" className="py-6 sm:py-8">
      <PageHeader
        title="Prescription orders"
        description="Scripts clinicians send to your pharmacy from Anixi. Update status as you prepare and dispense."
        badge={
          <span className="rounded-full bg-[#e8f0ec] px-2.5 py-1 text-xs font-semibold text-anixi-green">
            {counts.open} open · {counts.all} total
          </span>
        }
      />

      <PartnerFlash message={flash} tone={flashTone} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patient, doctor, or script…"
            className="w-full rounded-xl border border-[#d9e0da] bg-white py-2.5 pl-9 pr-3 text-sm text-[#1f2a26] shadow-sm focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusFilter === 'all'
                ? 'bg-anixi-green text-white'
                : 'border border-[#d9e0da] bg-white text-[#65758b]'
            }`}
          >
            All
          </button>
          {ORDER_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                statusFilter === opt.value
                  ? 'bg-anixi-green text-white'
                  : 'border border-[#d9e0da] bg-white text-[#65758b]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {loading || listingLoading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-[#dfe6e1]" />
          ) : error ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d9e0da] bg-white px-6 py-14 text-center">
              <p className="font-semibold text-[#344256]">No orders match this view</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-[#65758b]">
                When a clinician sends a prescription to {listing?.businessName || 'your pharmacy'},
                it appears here with the full script for fulfilment.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-soft">
              <ul className="divide-y divide-[#eef2ef]">
                {filtered.map((order) => {
                  const active = selectedId === order.id;
                  return (
                    <li key={order.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(order.id)}
                        className={`flex w-full flex-col gap-2 px-4 py-4 text-left transition sm:flex-row sm:items-center sm:justify-between ${
                          active ? 'bg-[#f0f7f3]' : 'hover:bg-[#f7faf8]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#1a4d4d]">
                            {order.patientName || 'Patient'}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-[#65758b]">
                            {order.source === 'marketplace'
                              ? 'Marketplace order'
                              : `From ${order.doctorName || 'clinician'}`}
                            {' · '}
                            {formatWhen(order.createdAt)}
                          </p>
                          {order.lineItems?.length ? (
                            <p className="mt-1 line-clamp-1 text-xs text-[#94a3b8]">
                              {order.lineItems
                                .map((i) => `${i.quantity ?? 1}× ${i.name}`)
                                .join(', ')}
                            </p>
                          ) : order.prescriptionText ? (
                            <p className="mt-1 line-clamp-1 text-xs text-[#94a3b8]">
                              {order.prescriptionText}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`inline-flex shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-semibold capitalize sm:self-center ${orderStatusClasses(
                            order.status,
                          )}`}
                        >
                          {orderStatusLabel(order.status)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <aside className="lg:col-span-2">
          <div className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-soft lg:sticky lg:top-24">
            {!selectedId ? (
              <div className="py-10 text-center">
                <p className="font-semibold text-[#344256]">Select an order</p>
                <p className="mt-1 text-sm text-[#65758b]">
                  Open a script to view the prescription and update fulfilment status.
                </p>
              </div>
            ) : detailLoading || !detail ? (
              <div className="h-48 animate-pulse rounded-xl bg-[#eef2ef]" />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                    Patient
                  </p>
                  <p className="mt-1 font-heading text-lg font-bold text-[#1a4d4d]">
                    {detail.patientName || 'Patient'}
                  </p>
                  {detail.patientPhone ? (
                    <a
                      href={`tel:${detail.patientPhone}`}
                      className="text-sm font-medium text-anixi-green hover:underline"
                    >
                      {detail.patientPhone}
                    </a>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                      {detail.source === 'marketplace' ? 'Source' : 'Prescriber'}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#344256]">
                      {detail.source === 'marketplace'
                        ? 'Patient Market order'
                        : detail.doctorName || '—'}
                    </p>
                    {detail.source !== 'marketplace' && detail.doctorEmail ? (
                      <p className="text-xs text-[#65758b]">{detail.doctorEmail}</p>
                    ) : null}
                    {detail.deliveryRequested ? (
                      <p className="mt-1 text-xs font-semibold text-anixi-green">
                        Delivery requested
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                      Received
                    </p>
                    <p className="mt-1 text-sm text-[#344256]">{formatWhen(detail.createdAt)}</p>
                  </div>
                </div>
                {detail.lineItems?.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                      Items
                    </p>
                    <ul className="mt-2 space-y-2 rounded-xl bg-[#f7faf8] px-3.5 py-3">
                      {detail.lineItems.map((item) => (
                        <li
                          key={`${item.name}-${item.price ?? ''}`}
                          className="flex items-start justify-between gap-3 text-sm text-[#344256]"
                        >
                          <span>
                            <span className="font-semibold">
                              {item.quantity ?? 1}× {item.name}
                            </span>
                            {item.description ? (
                              <span className="mt-0.5 block text-xs text-[#65758b]">
                                {item.description}
                              </span>
                            ) : null}
                          </span>
                          {item.price ? (
                            <span className="shrink-0 font-semibold text-anixi-green">
                              {item.price}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {detail.notes ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                      Patient notes
                    </p>
                    <p className="mt-2 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
                      {detail.notes}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#65758b]">
                    {detail.source === 'marketplace' ? 'Order summary' : 'Prescription'}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-[#f7faf8] px-3.5 py-3 text-sm leading-relaxed text-[#344256]">
                    {detail.prescriptionText || 'No details provided.'}
                  </pre>
                </div>
                <div>
                  <label className={partnerLabelClass} htmlFor="orderStatus">
                    Fulfilment status
                  </label>
                  <select
                    id="orderStatus"
                    className={partnerFieldClass}
                    value={(detail.status || 'sent').toLowerCase()}
                    disabled={updating}
                    onChange={(e) => void updateStatus(e.target.value)}
                  >
                    {ORDER_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} — {opt.hint}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-[#94a3b8]">Order ID {detail.id}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  );
};
