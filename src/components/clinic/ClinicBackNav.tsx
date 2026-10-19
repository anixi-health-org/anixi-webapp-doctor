import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import React from 'react';
import { useNavigate } from 'react-router-dom';

type ClinicBackNavProps = {
  label: string;
  to?: string;
  onClick?: () => void;
  className?: string;
};

export const ClinicBackNav: React.FC<ClinicBackNavProps> = ({
  label,
  to,
  onClick,
  className = '',
}) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        if (onClick) {
          onClick();
          return;
        }
        if (to) {
          navigate(to);
          return;
        }
        navigate(-1);
      }}
      className={`inline-flex h-9 items-center gap-2 rounded-lg border border-[#e1e7ef] bg-white px-3.5 text-sm font-medium text-[#344256] shadow-sm transition hover:border-[#c5cdd8] hover:text-[#0E2340] ${className}`}
    >
      <ArrowLeftIcon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
};

export default ClinicBackNav;
