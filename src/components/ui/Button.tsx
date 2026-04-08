import clsx from 'clsx';
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
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
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[#425950] text-white hover:bg-[#2d3e3a] focus:ring-[#425950]',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border-2 border-[#425950] bg-white text-[#425950] hover:bg-[#f6faeb] focus:ring-[#425950]',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
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
