import React from 'react';
import { customColors } from '../../lib/customColors';

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
    
    blue: `bg-anixi-card border-[${customColors.borderMedium}] hover:bg-[${customColors.backgroundMedium}]`,
    orange: `bg-anixi-card border-[${customColors.borderMedium}] hover:bg-[${customColors.backgroundMedium}]`,
    green: `bg-anixi-card border-[${customColors.borderMedium}] hover:bg-[${customColors.backgroundMedium}]`,
    red: `bg-anixi-card border-[${customColors.borderMedium}] hover:bg-[${customColors.backgroundMedium}]`,
  };

  const textColorClasses = {
    blue: `text-[${customColors.textPrimary}]`,
    orange: 'text-orange-700',
    green: 'text-green-700',
    red: 'text-red-700',
  };

  return (
    <div
      onClick={onClick}
      className={`
        border-2 rounded-xl p-6 cursor-pointer transition-all duration-200
        ${colorClasses[color]}
        ${isActive ? 'ring-2 ring-offset-2 ring-gray-400 shadow-lg' : 'shadow-md'}
        ${onClick ? 'hover:shadow-lg transform hover:scale-105' : ''}
      `}
    >
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col gap-2">
          <div className="text-3xl">{icon}</div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${textColorClasses[color]}`}>{value}</p>
          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>
      </div>
    </div>
  );
};
