import clsx from 'clsx';
import React from 'react';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'destructive' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  children,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-sans font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]';
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md focus:ring-primary',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm focus:ring-secondary',
    outline: 'border border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted hover:shadow-sm focus:ring-primary',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md focus:ring-destructive',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md focus:ring-destructive',
    success: 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md focus:ring-green-500',
    ghost: 'bg-transparent text-foreground hover:bg-muted hover:shadow-sm focus:ring-primary',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  return (
    <button
      disabled={disabled || isLoading}
      className={clsx(baseClasses, variants[variant], sizes[size], className)}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2"></span>
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
};
