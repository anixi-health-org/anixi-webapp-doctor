import React from 'react';
import clsx from 'clsx';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'md' | 'lg';
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  icon,
  size = 'md',
  className,
  ...props
}) => (
  <button
    type="button"
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-xl bg-anixi-green font-semibold text-white shadow-sm transition-all hover:bg-anixi-green/90 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-anixi-green focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      size === 'md' && 'px-4 py-2.5 text-sm',
      size === 'lg' && 'px-5 py-3 text-base',
      className
    )}
    {...props}
  >
    {icon}
    {children}
  </button>
);
