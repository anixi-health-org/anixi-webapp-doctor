import React from 'react';

interface TabPillProps {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const TabPill: React.FC<TabPillProps> = ({ active = false, children, onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
        active
          ? 'bg-[#425950] text-white shadow-sm'
          : 'text-[#8FA0B6] hover:text-[#425950] hover:bg-[#F7F9FB]'
      } ${className}`}
    >
      {children}
    </button>
  );
};

export default TabPill;