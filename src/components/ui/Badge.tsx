import clsx from 'clsx';
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
}) => {
  const variants = {
    success: 'bg-green-100 text-green-800 border border-green-300',
    warning: 'bg-amber-100 text-amber-800 border border-amber-300',
    danger: 'bg-red-100 text-red-800 border border-red-300',
    info: 'bg-blue-100 text-blue-800 border border-blue-300',
    default: 'bg-gray-100 text-gray-800 border border-gray-300',
  };

  const sizes = {
    sm: 'px-2.5 py-0.5 text-xs font-medium rounded-full',
    md: 'px-3 py-1 text-sm font-medium rounded-lg',
  };

  return (
    <span className={clsx(variants[variant], sizes[size], className)}>
      {children}
    </span>
  );
};
