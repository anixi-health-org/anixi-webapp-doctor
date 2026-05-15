import React from 'react';

interface DashboardStatsCardProps {
  label: string;
  value: number | string;
  icon: string;
  color: 'blue' | 'orange' | 'green' | 'red';
  onClick?: () => void;
  isActive?: boolean;
  description?: string;
}

export const DashboardStatsCard: React.FC<DashboardStatsCardProps> = ({
  label,
  value,
  icon,
  color,
  onClick,
  isActive,
  description,
}) => {
  const colorClasses = {
    blue: 'bg-[#F9F8FB] border-[#E6E3EE] hover:bg-[#F4F2F8]',
    orange: 'bg-[#FFF8F0] border-[#F6DFC5] hover:bg-[#FEF2E4]',
    green: 'bg-[#F3FCF8] border-[#CFEEDD] hover:bg-[#EAF9F2]',
    red: 'bg-[#FFF6F7] border-[#F4D7DA] hover:bg-[#FDEDEE]',
  };

  const textColorClasses = {
    blue: 'text-[#425950]',
    orange: 'text-orange-700',
    green: 'text-green-700',
    red: 'text-red-700',
  };

  return (
    <div
      onClick={onClick}
      className={`
        border rounded-3xl p-5 cursor-pointer transition-all duration-200
        ${colorClasses[color]}
        ${isActive ? 'ring-2 ring-offset-2 ring-[#6A7B74]/35 shadow-md' : 'shadow-sm'}
        ${onClick ? 'hover:shadow-md hover:-translate-y-0.5' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-white/80 border border-white shadow-sm flex items-center justify-center text-xl">
            {icon}
          </div>
          <div className="min-w-0">
            {description && <p className="text-sm text-[#7A8AA1] mb-1">{description}</p>}
            <p className="text-[26px] leading-none font-bold text-[#0E2340]">{value}</p>
            <p className="text-[12px] font-semibold text-[#74839A] mt-2 uppercase tracking-[0.08em]">{label}</p>
          </div>
        </div>
        <p className={`text-sm font-medium ${textColorClasses[color]}`}></p>
      </div>
    </div>
  );
};
