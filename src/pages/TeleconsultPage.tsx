import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useAuth } from '../hooks/useAuth';
import { getAppointmentById, updateAppointment } from '../services/appointmentService';
import {
  endTeleconsultSession,
  fetchTeleconsultToken,
  teleconsultErrorMessage,
} from '../services/teleconsultService';
import { Appointment, PostConsultAction } from '../types';
import { canDoctorStartVideoCall, isWhatsAppComingSoon } from '../utils/teleconsult';
import { PageShell } from '../components/page-layout';
import { DetailPageSkeleton } from '../components/ui';

const CALL_NOTES_TITLE = 'Call notes';
const CALL_NOTES_ACTION_ID = 'call_notes';

// React 19 JSX typing mismatch with LiveKit component packages
const Room = LiveKitRoom as unknown as React.FC<{
  token: string;
  serverUrl: string;
  connect?: boolean;
  video?: boolean;
  audio?: boolean;
  onDisconnected?: () => void;
  className?: string;
  children?: React.ReactNode;
}>;
const Conference = VideoConference as unknown as React.FC;
const AudioRenderer = RoomAudioRenderer as unknown as React.FC;

function findCallNotes(appointment: Appointment | null): PostConsultAction | undefined {
  if (!appointment?.postConsultActions?.length) return undefined;
  return appointment.postConsultActions.find(
    (a) => a.type === 'post_consult_note' && (a.id === CALL_NOTES_ACTION_ID || a.title === CALL_NOTES_TITLE)
  );
}

export const TeleconsultPage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [callNotes, setCallNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(true);
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedRef = useRef('');
  const callNotesRef = useRef('');
  const appointmentRef = useRef<Appointment | null>(null);

  useEffect(() => {
    callNotesRef.current = callNotes;
  }, [callNotes]);

  useEffect(() => {
    appointmentRef.current = appointment;
  }, [appointment]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!user?.id || !appointmentId) {
        setLoading(false);
        setError('Missing appointment or user.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const apt = await getAppointmentById(user.id, appointmentId);
        if (!apt) {
          throw new Error('Appointment not found.');
        }
        if (cancelled) return;
        setAppointment(apt);

        const existing = findCallNotes(apt);
        if (existing?.content) {
          setCallNotes(existing.content);
          lastSavedRef.current = existing.content;
        }

        if (isWhatsAppComingSoon(apt)) {
          throw new Error('WhatsApp consults are coming soon. Book a Virtual / video teleconsult instead.');
        }
        if (!canDoctorStartVideoCall(apt)) {
          throw new Error('This appointment cannot join a video call.');
        }
        if (!apt.teleconsultConsent?.obtained) {
          throw new Error(
            'Telemedicine consent must be confirmed before joining. Return to the visit briefing and check the consent box.'
          );
        }

        const creds = await fetchTeleconsultToken(user.id, appointmentId);
        if (cancelled) return;
        setServerUrl(creds.serverUrl);
        setToken(creds.token);
      } catch (err) {
        if (!cancelled) setError(teleconsultErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, user?.id]);

  const persistCallNotes = useCallback(
    async (content: string) => {
      if (!user?.id || !appointmentId) return;
      const apt = appointmentRef.current;
      if (!apt) return;

      const trimmed = content.trim();
      if (trimmed === lastSavedRef.current.trim()) return;

      setNotesStatus('saving');
      try {
        const now = new Date();
        const noteAction: PostConsultAction = {
          id: CALL_NOTES_ACTION_ID,
          type: 'post_consult_note',
          title: CALL_NOTES_TITLE,
          content: trimmed,
          status: 'draft',
          createdBy: user.id,
          createdAt: findCallNotes(apt)?.createdAt ?? now,
          updatedAt: now,
        };

        const others = (apt.postConsultActions ?? []).filter(
          (a) => !(a.type === 'post_consult_note' && (a.id === CALL_NOTES_ACTION_ID || a.title === CALL_NOTES_TITLE))
        );
        const nextActions = trimmed ? [noteAction, ...others] : others;

        await updateAppointment(user.id, appointmentId, {
          postConsultActions: nextActions,
        });

        lastSavedRef.current = trimmed;
        setAppointment((prev) =>
          prev
            ? {
                ...prev,
                postConsultActions: nextActions,
                updatedAt: now,
              }
            : prev
        );
        setNotesStatus('saved');
      } catch {
        setNotesStatus('error');
      }
    },
    [appointmentId, user?.id]
  );

  // Debounced auto-save while typing
  useEffect(() => {
    if (!appointment || !user?.id) return;
    if (callNotes === lastSavedRef.current) return;

    const timer = window.setTimeout(() => {
      void persistCallNotes(callNotes);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [appointment, callNotes, persistCallNotes, user?.id]);

  const goPostConsult = useCallback(async () => {
    if (!appointmentId) {
      navigate('/appointments');
      return;
    }

    await persistCallNotes(callNotesRef.current);

    const apt = appointmentRef.current;
    navigate(`/appointments/${appointmentId}/post-consult`, {
      state: apt
        ? {
            appointment: {
              ...apt,
              postConsultActions: apt.postConsultActions,
            },
            fromTeleconsult: true,
          }
        : { fromTeleconsult: true },
    });
  }, [appointmentId, navigate, persistCallNotes]);

  const handleEnd = async () => {
    if (!user?.id || !appointmentId || ending) return;
    setEnding(true);
    try {
      await persistCallNotes(callNotesRef.current);
      await endTeleconsultSession(user.id, appointmentId);
    } catch (err) {
      console.warn('endTeleconsult failed', err);
    } finally {
      setEnding(false);
      await goPostConsult();
    }
  };

  if (loading) {
    return (
      <PageShell>
        <DetailPageSkeleton />
      </PageShell>
    );
  }

  if (error || !serverUrl || !token) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg space-y-4 rounded-[20px] border border-[#D8DEE5] bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[#0E2340]">Unable to join teleconsult</h1>
          <p className="text-sm text-[#65758b]">{error || 'Missing LiveKit credentials.'}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate(appointmentId ? `/appointments/${appointmentId}` : '/appointments')}
              className="rounded-2xl border border-[#D8DEE5] px-4 py-2.5 text-sm font-semibold text-[#0E2340]"
            >
              Back
            </button>
            {appointmentId && (
              <button
                type="button"
                onClick={() => void goPostConsult()}
                className="rounded-2xl bg-[#06A66A] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Back to briefing
              </button>
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  const notesStatusLabel =
    notesStatus === 'saving'
      ? 'Saving…'
      : notesStatus === 'saved'
        ? 'Saved'
        : notesStatus === 'error'
          ? 'Save failed - will retry'
          : 'Auto-saves as you type';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#0E2340] md:h-screen">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            Teleconsult{appointment?.patientName ? ` · ${appointment.patientName}` : ''}
          </p>
          <p className="truncate text-xs text-white/70">Virtual video visit</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 lg:hidden"
          >
            {notesOpen ? 'Hide notes' : 'Notes'}
          </button>
          <button
            type="button"
            onClick={() => void handleEnd()}
            disabled={ending}
            className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
          >
            {ending ? 'Ending…' : 'End call'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1" data-lk-theme="default">
          <Room
            token={token}
            serverUrl={serverUrl}
            connect
            video
            audio
            onDisconnected={() => {
              void goPostConsult();
            }}
            className="h-full min-h-[280px]"
          >
            <Conference />
            <AudioRenderer />
          </Room>
        </div>

        <aside
          className={`${
            notesOpen ? 'flex' : 'hidden'
          } w-full shrink-0 flex-col border-t border-white/10 bg-[#122a4a] lg:flex lg:w-[340px] lg:border-l lg:border-t-0`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Visit notes</p>
              <p className="text-xs text-white/55">{notesStatusLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => void persistCallNotes(callNotes)}
              disabled={notesStatus === 'saving'}
              className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <textarea
            value={callNotes}
            onChange={(e) => {
              setCallNotes(e.target.value);
              if (notesStatus === 'saved' || notesStatus === 'error') setNotesStatus('idle');
            }}
            placeholder="Symptoms, assessment, plan… Notes are saved to this visit and available after the call."
            className="min-h-[200px] flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-white placeholder:text-white/35 outline-none"
          />
          <p className="border-t border-white/10 px-4 py-2 text-[11px] text-white/45">
            Visible on the consultation wrap-up page after you end the call.
          </p>
        </aside>
      </div>
    </div>
  );
};

export default TeleconsultPage;
