import clsx from 'clsx';
import React from 'react';

interface SkeletonProps {
  className?: string;
}

/** Base shimmer block — use Inter context via parent; decorative only. */
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
