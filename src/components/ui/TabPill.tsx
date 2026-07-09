import React from 'react';
import clsx from 'clsx';

interface TabPillProps {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const TabPill: React.FC<TabPillProps> = ({
  active = false,
  children,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200',
        active
          ? 'bg-anixi-green text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-50 hover:text-anixi-green',
        className
      )}
    >
      {children}
    </button>
  );
};

export default TabPill;
