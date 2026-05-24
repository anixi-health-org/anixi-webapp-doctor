import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, XMarkIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { getDoctorPatients } from '../../services/doctorService';
import { Patient } from '../../types';

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export const GlobalPatientSearch: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user?.id || patients.length > 0) return;
    setLoading(true);
    getDoctorPatients(user.id)
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, user?.id, patients.length]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const results = query.trim()
    ? patients.filter((p) => {
        const q = normalize(query);
        return (
          normalize(p.displayName || '').includes(q) ||
          normalize(p.email || '').includes(q)
        );
      }).slice(0, 8)
    : [];

  const handleSelect = (patient: Patient) => {
    setOpen(false);
    setQuery('');
    navigate(`/patient-profile/${patient.id}`);
  };

  return (
    <div ref={containerRef} className="relative">
      
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-anixi-green/20 bg-anixi-beige/50 text-anixi-green/70 text-sm hover:bg-anixi-beige transition-colors"
          aria-label="Search patients"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Search patients…</span>
        </button>
      )}

      
      {open && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-anixi-green/40 bg-white shadow-sm w-56 sm:w-72">
          <MagnifyingGlassIcon className="h-4 w-4 text-anixi-green/50 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients…"
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
            onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setQuery(''); } }}
          />
          <button
            onClick={() => { setOpen(false); setQuery(''); }}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close search"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      
      {open && (query.trim() || loading) && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {loading && (
            <p className="px-4 py-3 text-sm text-gray-400">Loading patients…</p>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <p className="px-4 py-3 text-sm text-gray-400">No patients found for "{query}"</p>
          )}
          {!loading && results.length > 0 && (
            <ul>
              {results.map((patient) => (
                <li key={patient.id}>
                  <button
                    onClick={() => handleSelect(patient)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-anixi-beige/60 text-left transition-colors"
                  >
                    <UserCircleIcon className="h-8 w-8 text-anixi-green/40 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {patient.displayName || 'Unnamed Patient'}
                      </p>
                      {patient.email && (
                        <p className="text-xs text-gray-400 truncate">{patient.email}</p>
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
