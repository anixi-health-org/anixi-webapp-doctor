import React, { useEffect, useRef, useState } from 'react';
import { listPracticePatientsPage } from '../../services/practicePatientService';
import type { Patient } from '../../types';

type Props = {
  practiceId: string;
  value: string;
  onChange: (patientId: string, patient?: Patient) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export const PracticePatientPicker: React.FC<Props> = ({
  practiceId,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Search name, email, or phone',
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      setQuery('');
    }
  }, [value]);

  useEffect(() => {
    if (!practiceId) return undefined;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      void listPracticePatientsPage(practiceId, {
        q: query.trim(),
        page: 1,
        limit: 20,
      })
        .then((page) => {
          if (cancelled) return;
          setResults(page.patients);
          setTotal(page.total);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setTotal(0);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [practiceId, query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const displayValue = open || !selected ? query : selected.displayName || selected.email || '';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {selected && !open ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e1e7ef] bg-[#fafcfb] px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#344256]">
              {selected.displayName || 'Unnamed patient'}
            </p>
            <p className="truncate text-xs text-[#65758b]">
              {selected.email || selected.phoneNumber || 'On clinic roster'}
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen(true);
              setQuery('');
            }}
            className="shrink-0 text-sm font-semibold text-anixi-green hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <input
          type="search"
          value={displayValue}
          required={required && !value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          className="w-full rounded-xl border border-[#e1e7ef] px-3 py-2.5 text-sm focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/20"
        />
      )}
      {open ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[#e1e7ef] bg-white py-1 shadow-lg">
          {loading ? (
            <li className="px-3 py-2 text-sm text-[#65758b]">Searching roster...</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[#65758b]">
              {query.trim() ? 'No patients match that search.' : 'Start typing to find a patient on the roster.'}
            </li>
          ) : (
            results.map((patient) => (
              <li key={patient.id}>
                <button
                  type="button"
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-[#eef4f1]"
                  onClick={() => {
                    setSelected(patient);
                    setQuery(patient.displayName || patient.email || '');
                    setOpen(false);
                    onChange(patient.id, patient);
                  }}
                >
                  <span className="text-sm font-medium text-[#344256]">
                    {patient.displayName || 'Unnamed patient'}
                  </span>
                  <span className="text-xs text-[#65758b]">
                    {patient.email || patient.phoneNumber || 'No contact on file'}
                  </span>
                </button>
              </li>
            ))
          )}
          {!loading && total > results.length ? (
            <li className="border-t border-[#eef2f6] px-3 py-2 text-xs text-[#94a3b8]">
              Showing {results.length} of {total}. Type to narrow the search.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
};
