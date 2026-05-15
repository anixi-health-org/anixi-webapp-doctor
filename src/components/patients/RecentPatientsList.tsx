import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClockIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { getRecentPatients, RecentPatientEntry } from '../../services/recentPatientsService';

interface RecentPatientsListProps {
  limit?: number;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const RecentPatientsList: React.FC<RecentPatientsListProps> = ({ limit = 5 }) => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<RecentPatientEntry[]>([]);

  useEffect(() => {
    setEntries(getRecentPatients().slice(0, limit));
  }, [limit]);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-gray-400 px-1 py-2">No recent patients yet.</p>
    );
  }

  return (
    <ul className="space-y-1">
      {entries.map((entry) => (
        <li key={entry.patientId}>
          <button
            onClick={() => navigate(`/patient-profile/${entry.patientId}`)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-anixi-beige/60 transition-colors text-left"
          >
            <UserCircleIcon className="h-8 w-8 text-anixi-green/50 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{entry.patientName}</p>
              {entry.email && (
                <p className="text-xs text-gray-400 truncate">{entry.email}</p>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
              <ClockIcon className="h-3.5 w-3.5" />
              {timeAgo(entry.visitedAt)}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
};
