import clsx from 'clsx';
import React from 'react';
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'alert' | 'success';
}
export const Card: React.FC<CardProps> = ({ children, className, variant = 'default', ...props }) => {
  const variants = {
    default: 'bg-white rounded-2xl shadow-card border border-gray-100/80',
    elevated: 'bg-white rounded-2xl shadow-elevated border border-gray-100',
    alert: 'bg-red-50 rounded-2xl border-l-4 border-red-500 shadow-soft',
    success: 'bg-green-50 rounded-2xl border-l-4 border-green-500 shadow-soft',
  };
  return (
    <div className={clsx(variants[variant], className)} {...props}>
      {children}
    </div>
  );
};
export const CardHeader: React.FC<CardProps> = ({ children, className, variant }) => {
  return (
    <div className={clsx('px-6 py-4 border-b border-gray-200', variant === 'alert' && 'border-red-200', variant === 'success' && 'border-green-200', className)}>
      {children}
    </div>
  );
};
export const CardContent: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={clsx('px-6 py-4', className)}>
      {children}
    </div>
  );
};
export const CardFooter: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={clsx('px-6 py-4 border-t border-gray-200 flex gap-3 justify-end', className)}>
      {children}
    </div>
  );
};
export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className 
}) => {
  return (
    <h3 className={clsx('font-heading text-lg font-semibold text-gray-900', className)}>
      {children}
    </h3>
  );
};
