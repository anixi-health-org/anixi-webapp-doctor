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
  <div className={clsx('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          {title}
        </h1>
        {badge}
      </div>
      {description && (
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-500 sm:text-base">
          {description}
        </p>
      )}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
  </div>
);
