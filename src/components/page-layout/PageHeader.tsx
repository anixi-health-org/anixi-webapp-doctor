import React from 'react';
import clsx from 'clsx';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  badge,
  className,
}) => (
  <div className={clsx('mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-[#344256] sm:text-[30px]">
          {title}
        </h1>
        {badge}
      </div>
      {description && (
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#65758b] sm:text-base">
          {description}
        </p>
      )}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
  </div>
);
