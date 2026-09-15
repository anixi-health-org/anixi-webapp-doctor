import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  Phone,
  UserRound,
  XCircle,
} from 'lucide-react';
import { IncomingSharingRequest } from '../../services/sharing';

interface SharingRequestsListProps {
  requests: IncomingSharingRequest[];
  loading: boolean;
  doctorId: string;
  onAccept: (patientId: string, doctorId: string, requestId: string) => Promise<void>;
  onReject: (patientId: string, doctorId: string, requestId: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}

const formatSentDate = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

export const SharingRequestsList: React.FC<SharingRequestsListProps> = ({
  requests,
  loading,
  doctorId,
  onAccept,
  onReject,
  onRefresh,
  refreshing = false,
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ patientId: string; requestId: string } | null>(
    null
  );

  const pendingRequests = useMemo(
    () => requests.filter((req) => req.status === 'pending'),
    [requests]
  );

  const handleAccept = async (patientId: string, requestId: string) => {
    try {
      setError(null);
      setActionType('accept');
      setLoadingId(requestId);
      await onAccept(patientId, doctorId, requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setLoadingId(null);
      setActionType(null);
    }
  };

  const handleReject = async (patientId: string, requestId: string) => {
    try {
      setError(null);
      setActionType('reject');
      setLoadingId(requestId);
      await onReject(patientId, doctorId, requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setLoadingId(null);
      setActionType(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {pendingRequests.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No incoming requests</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            New patient access requests will appear here.
          </p>
        </div>
      )}

      {pendingRequests.map((request) => {
        const patientName = request.patientName || request.patientEmail || 'Patient';
        const dateLabel = formatSentDate(request.createdAt);
        const isProcessing = loadingId === request.id;
        const subtitle =
          request.message?.trim() || 'Wants to share their health record';

        return (
          <article
            key={request.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-base font-semibold text-foreground">{patientName}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <UserRound className="h-4 w-4 shrink-0" />
                  <span className="truncate">{subtitle}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1">
                <Clock3 className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-700">Pending</span>
              </div>
            </div>

            {(request.patientEmail || request.patientPhone) && (
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                {request.patientEmail && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{request.patientEmail}</span>
                  </div>
                )}
                {request.patientPhone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{request.patientPhone}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>Sent {dateLabel}</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleAccept(request.patientId, request.id)}
                disabled={isProcessing}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {isProcessing && actionType === 'accept' ? 'Accepting...' : 'Accept'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRejectTarget({ patientId: request.patientId, requestId: request.id })}
                disabled={isProcessing}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                <span>
                  {isProcessing && actionType === 'reject' ? 'Rejecting...' : 'Reject'}
                </span>
              </button>
            </div>
          </article>
        );
      })}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Reject request?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will decline the patient access request. The patient will need to send a new request.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                disabled={loadingId === rejectTarget.requestId}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleReject(rejectTarget.patientId, rejectTarget.requestId);
                  setRejectTarget(null);
                }}
                disabled={loadingId === rejectTarget.requestId}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
              >
                Reject request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
