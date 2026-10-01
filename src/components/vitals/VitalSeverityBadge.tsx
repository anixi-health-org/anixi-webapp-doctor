import clsx from 'clsx';
import React from 'react';
import {
  severityLabel,
  type VitalSeverity,
} from '../../lib/vitalMetricRules';

const TONE: Record<VitalSeverity, string> = {
  normal: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-900 ring-amber-100',
  urgent: 'bg-rose-50 text-rose-800 ring-rose-100',
  unknown: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export const VitalSeverityBadge: React.FC<{
  severity: VitalSeverity;
  className?: string;
}> = ({ severity, className }) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
      TONE[severity],
      className
    )}
  >
    {severityLabel(severity)}
  </span>
);

export const vitalSeverityCardTone = (severity: VitalSeverity): string => {
  switch (severity) {
    case 'urgent':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'normal':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    default:
      return 'border-[#e1e7ef] bg-white text-[#427160]';
  }
};
