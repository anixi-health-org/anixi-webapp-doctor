import React, { useEffect, useState } from 'react';
import {
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { AyahScribeSummaryCard } from '../teleconsult/AyahScribeSummaryCard';
import {
  getPatientEncounterTimeline,
  type PatientEncounterTimelineItem,
  type UnichartEncounterRow,
} from '../../services/encounterSummaryService';

type Props = {
  patientId: string;
  practiceId?: string;
  doctorId?: string;
  unichartEncounters?: UnichartEncounterRow[];
  className?: string;
};

function SourceBadge({ source }: { source: PatientEncounterTimelineItem['source'] }) {
  if (source === 'ayah') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#427160]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#427160]">
        <SparklesIcon className="h-3 w-3" />
        Ayah
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-[#e8edf3] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#65758b]">
      Imported
    </span>
  );
}

function UnichartEncounterDetails({ row }: { row: UnichartEncounterRow }) {
  const fields: Array<{ label: string; value?: string }> = [
    { label: 'Encounter date', value: row.date },
    { label: 'Visit type', value: row.type },
    { label: 'Encounter number', value: row.number },
  ];

  return (
    <div className="space-y-3 rounded-xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
      <p className="text-xs font-semibold text-[#344256]">Imported encounter record</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#65758b]">
              {label}
            </dt>
            <dd className="mt-0.5 text-sm text-[#344256]">{value?.trim() || '—'}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-[#65758b]">
        Legacy import metadata. Visit narrative is in problems & history above; Anixi video visits get
        Ayah summaries in this list.
      </p>
    </div>
  );
}

export const PatientRecentEncountersPanel: React.FC<Props> = ({
  patientId,
  practiceId,
  doctorId,
  unichartEncounters,
  className = '',
}) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<PatientEncounterTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const unichartKey = JSON.stringify(unichartEncounters ?? []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setOpenId(null);
      try {
        const timeline = await getPatientEncounterTimeline(patientId, {
          practiceId,
          doctorId,
          unichartEncounters,
        });
        if (!cancelled) {
          setItems(timeline);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [patientId, practiceId, doctorId, unichartKey, unichartEncounters]);

  return (
    <div className={className}>
      <p className="text-xs font-medium text-[#65758b]">Recent encounters</p>
      {loading ? (
        <p className={`${readOnlyShell} text-sm text-[#65758b]`}>Loading encounter history…</p>
      ) : items.length === 0 ? (
        <p className={`${readOnlyShell} text-sm text-[#65758b]`}>No encounters on file yet.</p>
      ) : (
        <ul className="mt-1 space-y-2">
          {items.map((item) => {
            const expanded = openId === item.id;
            return (
              <li
                key={item.id}
                className="overflow-hidden rounded-xl border border-[#e1e7ef] bg-[#f8fafc]"
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-white/80"
                  aria-expanded={expanded}
                  onClick={() => setOpenId((current) => (current === item.id ? null : item.id))}
                >
                  <ChevronDownIcon
                    className={`mt-0.5 h-4 w-4 shrink-0 text-[#65758b] transition ${expanded ? 'rotate-180' : ''}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#0E2340]">{item.dateLabel}</span>
                      <SourceBadge source={item.source} />
                      <span className="text-xs text-[#65758b]">{item.title}</span>
                      {item.doctorName ? (
                        <span className="text-xs text-[#8FA0B6]">· {item.doctorName}</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-[#344256]">
                      {item.summaryLine}
                    </span>
                  </span>
                </button>

                {expanded ? (
                  <div className="space-y-3 border-t border-[#e1e7ef] bg-white px-3 py-4">
                    {item.source === 'ayah' && item.note ? (
                      <>
                        <AyahScribeSummaryCard
                          note={item.note}
                          onApply={() => undefined}
                          readOnly
                        />
                        {item.appointmentId ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/appointments/${item.appointmentId}/post-consult`)
                            }
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#427160]/30 px-3 text-xs font-semibold text-[#427160] hover:bg-[#eef4f1]"
                          >
                            Open visit wrap-up
                            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {item.source === 'unichart' && item.unichart ? (
                      <UnichartEncounterDetails row={item.unichart} />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-[#8FA0B6]">Expand a row for full Ayah SOAP or import details.</p>
    </div>
  );
};

const readOnlyShell =
  'mt-1 w-full rounded-xl border border-[#e1e7ef] bg-[#f8fafc] px-3 py-2.5';
