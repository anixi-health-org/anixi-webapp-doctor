import clsx from 'clsx';
import React from 'react';

interface SkeletonProps {
  className?: string;
}

/** Base shimmer block - use Inter context via parent; decorative only. */
export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div
    className={clsx('animate-pulse rounded-lg bg-gradient-to-r from-gray-200/80 via-gray-100/90 to-gray-200/80', className)}
    aria-hidden
  />
);

export const SkeletonCircle: React.FC<{ size?: string; className?: string }> = ({
  size = 'h-10 w-10',
  className,
}) => <Skeleton className={clsx('rounded-full', size, className)} />;

export const PageHeaderSkeleton: React.FC = () => (
  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="space-y-2">
      <Skeleton className="h-8 w-56 sm:h-9" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
    <Skeleton className="h-10 w-40 rounded-xl" />
  </div>
);

export const StatCardsSkeleton: React.FC<{ count?: number; columns?: number }> = ({
  count = 4,
  columns = 4,
}) => (
  <div
    className={clsx(
      'mb-6 grid gap-4',
      columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      columns === 6 && 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
      columns === 3 && 'grid-cols-1 sm:grid-cols-3'
    )}
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const CardSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-card">
    <Skeleton className="mb-5 h-6 w-40" />
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-50 p-4">
          <SkeletonCircle size="h-11 w-11" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

export const ListRowsSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4">
        <SkeletonCircle />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    ))}
  </div>
);

export const InvoicePageSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <StatCardsSkeleton count={4} columns={4} />
    <div className="rounded-2xl border border-gray-100 bg-white shadow-card">
      <div className="border-b border-gray-100 px-6 py-4">
        <Skeleton className="h-6 w-36" />
      </div>
      <div className="p-6">
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="mb-6 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <ListRowsSkeleton rows={3} />
      </div>
    </div>
  </>
);

export const AppointmentsPageSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <StatCardsSkeleton count={6} columns={6} />
    <CardSkeleton rows={4} />
  </>
);

export const DashboardPageSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <StatCardsSkeleton count={4} columns={4} />
    <div className="grid gap-6 lg:grid-cols-2">
      <CardSkeleton rows={5} />
      <CardSkeleton rows={3} />
    </div>
  </>
);

export const PatientsPageSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <Skeleton className="mb-6 h-12 w-full max-w-md rounded-2xl" />
    <CardSkeleton rows={6} />
  </>
);

export const AppShellSkeleton: React.FC = () => (
  <div className="flex h-screen overflow-hidden bg-[#F4F6EF]">
    <aside className="hidden w-[272px] shrink-0 bg-anixi-green md:block">
      <div className="flex items-center gap-3 px-5 py-6">
        <Skeleton className="h-10 w-10 rounded-xl bg-white/20" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 bg-white/20" />
          <Skeleton className="h-2 w-20 bg-white/15" />
        </div>
      </div>
      <div className="space-y-2 px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl bg-white/10" />
        ))}
      </div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-16 items-center justify-between border-b border-gray-200/70 bg-white px-6">
        <Skeleton className="h-5 w-48 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <div className="flex-1 overflow-auto p-6 sm:p-8">
        <DashboardPageSkeleton />
      </div>
    </div>
  </div>
);

/** Full-page shell placeholder while caregiver auth resolves */
export const CaregiverAppShellSkeleton: React.FC = () => <AppShellSkeleton />;

export const CaregiverPatientDetailSkeleton: React.FC = () => (
  <>
    <Skeleton className="mb-6 h-5 w-32" />
    <PageHeaderSkeleton />
    <div className="mb-6 flex gap-1 rounded-2xl border border-gray-100 bg-white p-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 flex-1 rounded-xl" />
      ))}
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <CardSkeleton rows={4} />
      <CardSkeleton rows={3} />
    </div>
  </>
);

/** Matches Patient Details layout while profile data loads */
export const PatientProfileSkeleton: React.FC = () => (
  <div className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-[10px]" />
            <Skeleton className="h-8 w-48 sm:h-9" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-[10px]" />
          <Skeleton className="h-9 w-20 rounded-[10px]" />
        </div>
      </div>

      <div className="mb-6 rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <SkeletonCircle size="h-16 w-16" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[12px] border border-[#e1e7ef] bg-white p-4 shadow-sm">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={3} />
        </div>
        <div className="space-y-4">
          <CardSkeleton rows={3} />
          <CardSkeleton rows={2} />
        </div>
      </div>
    </div>
  </div>
);

export const DetailPageSkeleton: React.FC = () => (
  <>
    <Skeleton className="mb-4 h-9 w-44 rounded-[10px]" />
    <PageHeaderSkeleton />
    <CardSkeleton rows={5} />
  </>
);

export const CalendarPageSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="space-y-4">
        <Skeleton className="h-56 w-full rounded-[12px]" />
        <Skeleton className="h-40 w-full rounded-[12px]" />
      </div>
      <Skeleton className="min-h-[420px] w-full rounded-[12px]" />
    </div>
  </>
);

export const SettingsPageSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <div className="mb-4 flex gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-full" />
      ))}
    </div>
    <CardSkeleton rows={6} />
  </>
);

export const AdherenceLogsSkeleton: React.FC = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        className="flex items-start justify-between rounded-[12px] border border-[#e1e7ef] bg-white p-4"
      >
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
    ))}
  </div>
);

export const DailyAdherenceSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-9 w-24 rounded-[10px]" />
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-9 w-24 rounded-[10px]" />
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-[12px]" />
      ))}
    </div>
    <CardSkeleton rows={3} />
  </div>
);

export const VitalsPageSkeleton: React.FC = () => (
  <>
    <Skeleton className="mb-4 h-9 w-44 rounded-[10px]" />
    <PageHeaderSkeleton />
    <div className="mb-6 grid gap-4 md:grid-cols-2">
      <Skeleton className="h-32 rounded-[12px]" />
      <Skeleton className="h-32 rounded-[12px]" />
    </div>
    <ListRowsSkeleton rows={4} />
  </>
);

export const InvoiceDetailSkeleton: React.FC = () => (
  <>
    <Skeleton className="mb-4 h-9 w-32 rounded-[10px]" />
    <PageHeaderSkeleton />
    <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-6 shadow-sm">
      <div className="mb-6 flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <ListRowsSkeleton rows={3} />
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-10 w-28 rounded-[10px]" />
        <Skeleton className="h-10 w-28 rounded-[10px]" />
      </div>
    </div>
  </>
);

export const PostConsultSkeleton: React.FC = () => (
  <div className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:px-6">
    <div className="mx-auto max-w-5xl space-y-4">
      <Skeleton className="h-9 w-28 rounded-[10px]" />
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[12px]" />
        ))}
      </div>
      <CardSkeleton rows={4} />
    </div>
  </div>
);

export const SharePageSkeleton: React.FC = () => (
  <>
    <PageHeaderSkeleton />
    <StatCardsSkeleton count={2} columns={3} />
    <CardSkeleton rows={3} />
    <CardSkeleton rows={2} />
  </>
);

/** Accessible wrapper for full-page loading placeholders */
export const PageLoadingState: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

export const DataTablePageSkeleton: React.FC<{
  columns?: number;
  rows?: number;
  withToolbar?: boolean;
}> = ({ columns = 5, rows = 8, withToolbar = true }) => (
  <div className="overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white">
    {withToolbar ? (
      <div className="flex flex-col gap-3 border-b border-[#eef2f6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full max-w-xs rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
    ) : null}
    <div className="border-b border-[#eef2f6] bg-[#fafcfb] px-4 py-3">
      <div className="flex gap-6">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
    </div>
    <div className="divide-y divide-[#eef2f6]">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton
              key={col}
              className={clsx(
                'h-4',
                col === 0 ? 'w-32' : col === columns - 1 ? 'w-20' : 'w-24',
              )}
            />
          ))}
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between border-t border-[#eef2f6] px-4 py-3">
      <Skeleton className="h-4 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  </div>
);

export const ClinicReportsPageSkeleton: React.FC = () => (
  <PageLoadingState label="Loading clinic reports">
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[#e1e7ef] bg-white p-5 shadow-sm">
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e1e7ef] bg-white p-6">
          <Skeleton className="mb-4 h-6 w-48" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="mb-1 flex justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[#e1e7ef] bg-white p-6">
          <Skeleton className="mb-4 h-6 w-40" />
          <StatCardsSkeleton count={3} columns={3} />
        </div>
      </div>
      <CardSkeleton rows={3} />
    </div>
  </PageLoadingState>
);

export const QueueTableSkeleton: React.FC = () => (
  <PageLoadingState label="Loading front desk queue">
    <DataTablePageSkeleton columns={6} rows={6} withToolbar={false} />
  </PageLoadingState>
);

export const AccountFormPageSkeleton: React.FC = () => (
  <PageLoadingState label="Loading account details">
    <Skeleton className="mb-4 h-5 w-40" />
    <div className="mb-6 flex gap-2 overflow-x-auto">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
      ))}
    </div>
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="rounded-2xl border border-[#e1e7ef] bg-white p-6">
          <Skeleton className="mb-5 h-6 w-44" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </PageLoadingState>
);

export const ClinicOverviewPageSkeleton: React.FC = () => (
  <PageLoadingState label="Loading clinic overview">
    <Skeleton className="h-4 w-72 max-w-full" />
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 rounded-2xl border border-[#e1e7ef] bg-white p-5">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <CardSkeleton rows={4} />
      <CardSkeleton rows={3} />
    </div>
  </PageLoadingState>
);

export const InlinePanelSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <PageLoadingState label="Loading">
    <ListRowsSkeleton rows={rows} />
  </PageLoadingState>
);

export const ClaimsPageSkeleton: React.FC = () => (
  <PageLoadingState label="Loading medical aid claims">
    <PageHeaderSkeleton />
    <DataTablePageSkeleton columns={5} rows={5} withToolbar={false} />
  </PageLoadingState>
);

