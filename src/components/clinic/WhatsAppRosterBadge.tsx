import React from 'react';
import {
  type WhatsAppRosterStatus,
  whatsAppRosterLabel,
} from '../../lib/formatSaPhone';

type Props = {
  status?: WhatsAppRosterStatus | null;
};

export function WhatsAppRosterBadge({ status }: Props) {
  if (!status) {
    return <span className="text-xs text-[#9aa8a2]">—</span>;
  }

  const label = whatsAppRosterLabel(status);
  const className =
    status === 'verified' || status === 'reachable'
      ? 'bg-emerald-50 text-emerald-800'
      : status === 'not_on_whatsapp' || status === 'invalid'
        ? 'bg-rose-50 text-rose-800'
        : 'bg-slate-100 text-slate-600';

  return (
    <span
      className={`inline-flex max-w-[140px] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight ${className}`}
      title={label}
    >
      {(status === 'verified' || status === 'reachable') && (
        <span className="text-[10px]" aria-hidden>
          WA
        </span>
      )}
      {label}
    </span>
  );
}
