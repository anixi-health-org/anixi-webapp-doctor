import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, XMarkIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useAuth } from '../../hooks/useAuth';
import { getDoctorPatients } from '../../services/doctorService';
import { Patient } from '../../types';

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

interface GlobalPatientSearchProps {
  variant?: 'compact' | 'expanded';
}

export const GlobalPatientSearch: React.FC<GlobalPatientSearchProps> = ({
  variant = 'compact',
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(variant === 'expanded');
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isExpanded = variant === 'expanded';

  useEffect(() => {
    if ((!open && !isExpanded) || !user?.id || patients.length > 0) return;
    setLoading(true);
    getDoctorPatients(user.id)
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, isExpanded, user?.id, patients.length]);

  useEffect(() => {
    if (open || isExpanded) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, isExpanded]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!isExpanded) setOpen(false);
      }
    };
    if (open || isExpanded) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, isExpanded]);

  const results = query.trim()
    ? patients
        .filter((p) => {
          const q = normalize(query);
          return (
            normalize(p.displayName || '').includes(q) ||
            normalize(p.email || '').includes(q)
          );
        })
        .slice(0, 8)
    : [];

  const handleSelect = (patient: Patient) => {
    if (!isExpanded) setOpen(false);
    setQuery('');
    navigate(`/patient-profile/${patient.id}`);
  };

  const showResults = (open || isExpanded) && (query.trim() || loading);

  return (
    <div ref={containerRef} className={clsx('relative', isExpanded && 'w-full')}>
      {!open && !isExpanded && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] px-3.5 py-2 text-sm text-[#65758b] transition-all hover:border-[#427160]/40 hover:bg-white hover:text-[#344256]"
          aria-label="Search patients"
        >
          <MagnifyingGlassIcon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Search patients…</span>
        </button>
      )}

      {(open || isExpanded) && (
        <div
          className={clsx(
            'flex items-center gap-2 rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] px-3 py-2',
            isExpanded ? 'h-10 w-full' : 'w-56 sm:w-72 shadow-sm'
          )}
        >
          <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-[#65758b]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients, appointments..."
            className="flex-1 bg-transparent text-sm text-[#344256] placeholder-[#65758b] outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (!isExpanded) setOpen(false);
                setQuery('');
              }
            }}
          />
          {!isExpanded && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery('');
              }}
              className="text-[#65758b] hover:text-[#344256]"
              aria-label="Close search"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {showResults && (
        <div
          className={clsx(
            'absolute top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-xl',
            isExpanded ? 'left-0 right-0' : 'right-0 w-72 sm:w-80'
          )}
        >
          {loading && <p className="px-4 py-3 text-sm text-[#65758b]">Loading patients…</p>}
          {!loading && results.length === 0 && query.trim() && (
            <p className="px-4 py-3 text-sm text-[#65758b]">No patients found for "{query}"</p>
          )}
          {!loading && results.length > 0 && (
            <ul>
              {results.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(patient)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#f8fafc]"
                  >
                    <UserCircleIcon className="h-8 w-8 shrink-0 text-[#427160]/40" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#344256]">
                        {patient.displayName || 'Unnamed Patient'}
                      </p>
                      {patient.email && (
                        <p className="truncate text-xs text-[#65758b]">{patient.email}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
