import clsx from 'clsx';
import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface AlertProps {
  children: React.ReactNode;
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  type = 'info',
  title,
  onClose,
  className,
}) => {
  const typeClasses = {
    success: 'bg-green-50 border border-green-300 text-green-800',
    error: 'bg-red-50 border border-red-300 text-red-800',
    warning: 'bg-amber-50 border border-amber-300 text-amber-800',
    info: 'bg-blue-50 border border-blue-300 text-blue-800',
  };

  return (
    <div className={clsx('rounded-lg p-4 flex gap-3', typeClasses[type], className)}>
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        <p className="text-sm">{children}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-current opacity-70 hover:opacity-100 transition-opacity"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};
