import React, { useEffect, useState } from 'react';
import { Clock, User, Bot, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import type { CentralEventLogEntry, CentralEventActorType } from '../../types';
import { listCentralEvents, centralEventActionLabel } from '../../services/centralEventLogService';

interface EventLogPanelProps {
  organizationId: string;
}

type ActorTypeFilter = 'all' | CentralEventActorType;
type OutcomeFilter = 'all' | 'success' | 'failed' | 'pending' | 'cancelled';

const ACTOR_TYPE_LABELS: Record<ActorTypeFilter, string> = {
  all: 'All Actors',
  user: 'Users',
  ayah: 'Ayah',
  system: 'System',
};

const OUTCOME_LABELS: Record<OutcomeFilter, string> = {
  all: 'All Outcomes',
  success: 'Success',
  failed: 'Failed',
  pending: 'Pending',
  cancelled: 'Cancelled',
};

const OUTCOME_ICONS: Record<CentralEventLogEntry['outcome'], React.ElementType> = {
  success: CheckCircle,
  failed: XCircle,
  pending: AlertCircle,
  cancelled: XCircle,
};

const OUTCOME_COLORS: Record<CentralEventLogEntry['outcome'], string> = {
  success: 'text-green-600',
  failed: 'text-red-600',
  pending: 'text-yellow-600',
  cancelled: 'text-gray-600',
};

const ACTOR_ICONS: Record<CentralEventActorType, React.ElementType> = {
  user: User,
  ayah: Bot,
  system: AlertCircle,
};

const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatFullTimestamp = (date: Date): string => {
  return date.toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const EventLogPanel: React.FC<EventLogPanelProps> = ({ organizationId }) => {
  const [events, setEvents] = useState<CentralEventLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actorTypeFilter, setActorTypeFilter] = useState<ActorTypeFilter>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const loadEvents = async () => {
    if (!organizationId) return;

    setLoading(true);
    setError(null);

    try {
      const loadedEvents = await listCentralEvents({
        organizationId,
        actorType: actorTypeFilter === 'all' ? undefined : actorTypeFilter,
        outcome: outcomeFilter === 'all' ? undefined : outcomeFilter,
        limit: 100,
      });
      setEvents(loadedEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, actorTypeFilter, outcomeFilter]);

  const toggleExpand = (eventId: string) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  const filteredEvents = events;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 text-sm">{error}</p>
        <button
          onClick={loadEvents}
          className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  if (filteredEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-500 text-sm">No events found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>
        
        <select
          value={actorTypeFilter}
          onChange={(e) => setActorTypeFilter(e.target.value as ActorTypeFilter)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(ACTOR_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Event List */}
      <div className="space-y-2">
        {filteredEvents.map((event) => {
          const ActorIcon = ACTOR_ICONS[event.actorType];
          const OutcomeIcon = OUTCOME_ICONS[event.outcome];
          const isExpanded = expandedEventId === event.id;

          return (
            <div
              key={event.id}
              className="border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <button
                onClick={() => toggleExpand(event.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left"
              >
                <ActorIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {centralEventActionLabel(event.action)}
                    </span>
                    <OutcomeIcon className={`h-4 w-4 ${OUTCOME_COLORS[event.outcome]}`} />
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-0.5">{event.summary}</p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-500">{formatTimestamp(event.createdAt)}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 pt-0 border-t border-gray-100 mt-2">
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <span className="text-gray-500">Actor:</span>
                      <span className="ml-2 text-gray-900">
                        {event.actorName || event.actorUid || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Target:</span>
                      <span className="ml-2 text-gray-900 capitalize">
                        {event.targetType}
                        {event.targetId && ` (${event.targetId.slice(0, 8)}...)`}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Outcome:</span>
                      <span className={`ml-2 ${OUTCOME_COLORS[event.outcome]} capitalize`}>
                        {event.outcome}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Time:</span>
                      <span className="ml-2 text-gray-900">
                        {formatFullTimestamp(event.createdAt)}
                      </span>
                    </div>
                  </div>

                  {event.confirmation && (
                    <div className="mt-3">
                      <span className="text-gray-500 text-sm">Confirmation:</span>
                      <span className="ml-2 text-sm text-gray-900 font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {event.confirmation}
                      </span>
                    </div>
                  )}

                  {(event.oldValue !== undefined || event.newValue !== undefined) && (
                    <div className="mt-3 space-y-2">
                      {event.oldValue !== undefined && (
                        <div>
                          <span className="text-gray-500 text-sm block mb-1">Old Value:</span>
                          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                            {JSON.stringify(event.oldValue, null, 2)}
                          </pre>
                        </div>
                      )}
                      {event.newValue !== undefined && (
                        <div>
                          <span className="text-gray-500 text-sm block mb-1">New Value:</span>
                          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                            {JSON.stringify(event.newValue, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="mt-3">
                      <span className="text-gray-500 text-sm block mb-1">Metadata:</span>
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {events.length >= 100 && (
        <p className="text-center text-sm text-gray-500 py-4">
          Showing the most recent 100 events
        </p>
      )}
    </div>
  );
};
