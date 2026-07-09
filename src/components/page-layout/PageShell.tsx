import React from 'react';
import clsx from 'clsx';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'default' | 'wide' | 'full';
}

export const PageShell: React.FC<PageShellProps> = ({
  children,
  className,
  maxWidth = 'default',
}) => {
  const widthClass = {
    default: 'max-w-7xl',
    wide: 'max-w-[90rem]',
    full: 'max-w-none',
  }[maxWidth];

  return (
    <div className={clsx('mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8', widthClass, className)}>
      {children}
    </div>
  );
};
