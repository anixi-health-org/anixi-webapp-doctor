import React from 'react';

type Props = {
  patientName?: string;
  sources?: string[];
};

export function AyahChartSources({ patientName, sources }: Props) {
  if (!patientName && (!sources || sources.length === 0)) return null;

  const items =
    sources && sources.length > 0
      ? sources
      : patientName
        ? [`Anixi chart for ${patientName}`, 'Live practice snapshot']
        : [];

  if (items.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-[#e8eaed] bg-[#fafafa] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
        Chart sources
      </p>
      <ul className="mt-1 space-y-0.5">
        {items.slice(0, 4).map((source) => (
          <li key={source} className="text-xs text-[#65758b]">
            {source}
          </li>
        ))}
      </ul>
    </div>
  );
}
