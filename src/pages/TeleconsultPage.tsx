import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ConnectionState, RoomEvent } from 'livekit-client';
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
import { TeleconsultStage } from '../components/teleconsult/TeleconsultStage';
import { AyahScribePanel } from '../components/teleconsult/AyahScribePanel';
import {
  LiveKitScribeController,
  type LiveKitScribeHandle,
  type LiveKitScribeState,
} from '../components/teleconsult/LiveKitScribeController';
import {
  AYAH_SCRIBE_ACTION_ID,
  AYAH_SCRIBE_TITLE,
  structureConsultTranscript,
  type ConsultScribeNote,
} from '../services/consultScribeService';

const CALL_NOTES_TITLE = 'Call notes';
const CALL_NOTES_ACTION_ID = 'call_notes';

// React 19 JSX typing mismatch with LiveKit component packages
const Room = LiveKitRoom as unknown as React.FC<{
  token: string;
  serverUrl: string;
  connect?: boolean;
  video?: boolean;
  audio?: boolean;
  options?: {
    adaptiveStream?: boolean | { pixelDensity?: 'screen' | number };
    dynacast?: boolean;
  };
  connectOptions?: { autoSubscribe?: boolean };
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onMediaDeviceFailure?: (failure?: unknown, kind?: MediaDeviceKind) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}>;
const AudioRenderer = RoomAudioRenderer as unknown as React.FC;

function mediaPermissionMessage(err: unknown): string {
  const text =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Camera or microphone permission was denied';
  if (/permission|denied|notallowed|not allowed/i.test(text)) {
    return 'Camera/mic blocked in the browser. Allow access for this site, then tap the camera button.';
  }
  return text;
}

/** Enable mic/camera after the room is connected, never throw into the page overlay. */
function EnableLocalMedia({ onHint }: { onHint: (hint: string | null) => void }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const started = useRef(false);

  useEffect(() => {
    if (!room || !localParticipant || started.current) return;

    const enable = async () => {
      if (started.current) return;
      if (room.state !== ConnectionState.Connected) return;
      started.current = true;
      try {
        await localParticipant.setMicrophoneEnabled(true);
      } catch (err) {
        onHint(mediaPermissionMessage(err));
      }
      try {
        await localParticipant.setCameraEnabled(true);
        onHint(null);
      } catch (err) {
        onHint(mediaPermissionMessage(err));
      }
    };

    void enable();
    room.on(RoomEvent.Connected, enable);
    return () => {
      room.off(RoomEvent.Connected, enable);
    };
  }, [room, localParticipant, onHint]);

  return null;
}

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
  const [mediaHint, setMediaHint] = useState<string | null>(null);
  const [scribeEnabled, setScribeEnabled] = useState(false);
  const [scribeFinalizing, setScribeFinalizing] = useState(false);
  const scribeRef = useRef<LiveKitScribeHandle>(null);
  const [scribeState, setScribeState] = useState<LiveKitScribeState>({
    listening: false,
    processing: false,
    transcript: '',
    segmentCount: 0,
    audioTrackCount: 0,
    error: null,
  });
  const lastSavedRef = useRef('');
  const callNotesRef = useRef('');
  const appointmentRef = useRef<Appointment | null>(null);
  const endingCallRef = useRef(false);

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
          const ended = apt.teleconsult?.status === 'ended';
          const closed = ['cancelled', 'auto_cancelled', 'no_show', 'completed'].includes(
            apt.status
          );
          throw new Error(
            ended && closed
              ? 'This video visit has ended.'
              : closed
                ? 'This appointment is closed and can no longer join a video call.'
                : 'This appointment is not set up as a video consultation.'
          );
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

  const persistAyahScribeNote = useCallback(
    async (note: ConsultScribeNote, transcriptLength: number) => {
      if (!user?.id || !appointmentId) return;
      const apt = appointmentRef.current;
      if (!apt) return;

      const trimmed = note.fullText.trim();
      if (!trimmed) return;

      const now = new Date();
      const existing = apt.postConsultActions ?? [];
      const scribeAction: PostConsultAction = {
        id: AYAH_SCRIBE_ACTION_ID,
        type: 'post_consult_note',
        title: AYAH_SCRIBE_TITLE,
        content: trimmed,
        status: 'draft',
        metadata: {
          source: 'ayah_scribe',
          transcriptLength,
          summary: note.summary,
          subjective: note.subjective,
          objective: note.objective,
          assessment: note.assessment,
          plan: note.plan,
          followUps: note.followUps.join('|'),
        },
        createdBy: user.id,
        createdAt:
          existing.find((action) => action.id === AYAH_SCRIBE_ACTION_ID)?.createdAt ?? now,
        updatedAt: now,
      };

      const nextActions = [
        ...existing.filter((action) => action.id !== AYAH_SCRIBE_ACTION_ID),
        scribeAction,
      ];

      await updateAppointment(user.id, appointmentId, {
        postConsultActions: nextActions,
        updatedAt: now,
      });

      setAppointment((prev) =>
        prev
          ? {
              ...prev,
              postConsultActions: nextActions,
              updatedAt: now,
            }
          : prev,
      );
    },
    [appointmentId, user?.id],
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
    endingCallRef.current = true;
    setEnding(true);
    try {
      await persistCallNotes(callNotesRef.current);

      if (scribeEnabled) {
        setScribeFinalizing(true);
        const rawTranscript = (await scribeRef.current?.stop()) ?? '';
        if (rawTranscript.length > 24 && appointmentRef.current) {
          try {
            const structured = await structureConsultTranscript({
              transcript: rawTranscript,
              patientName: appointmentRef.current.patientName || 'Patient',
              appointmentId,
              context: {
                patientId: appointmentRef.current.patientId,
                appointmentId,
                patientName: appointmentRef.current.patientName,
              },
            });
            if (structured.fullText) {
              await persistAyahScribeNote(structured, rawTranscript.length);
            }
          } catch (err) {
            console.warn('[TeleconsultPage] Ayah scribe finalize failed', err);
          }
        }
        setScribeFinalizing(false);
      }

      await endTeleconsultSession(user.id, appointmentId);
    } catch (err) {
      console.warn('endTeleconsult failed', err);
    } finally {
      setScribeFinalizing(false);
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#0E2340]">
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
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col" data-lk-theme="default">
          <Room
            token={token}
            serverUrl={serverUrl}
            connect
            // Connect first without capturing devices. Auto-enable on SignalConnected
            // throws "Permission denied by user" into the CRA overlay and can stall
            // the call UI before remote tracks are attached.
            video={false}
            audio={false}
            options={{ adaptiveStream: false, dynacast: false }}
            connectOptions={{ autoSubscribe: true }}
            onError={(err) => {
              console.warn('[teleconsult] room error', err);
              setMediaHint(mediaPermissionMessage(err));
            }}
            onMediaDeviceFailure={(failure, kind) => {
              console.warn('[teleconsult] media device failure', failure, kind);
              setMediaHint(
                kind === 'videoinput'
                  ? 'Camera blocked. Allow camera access, then tap the camera button.'
                  : kind === 'audioinput'
                    ? 'Microphone blocked. Allow mic access, then tap the mic button.'
                    : 'Camera or microphone blocked. Allow access in the browser, then retry from the controls.'
              );
            }}
            onDisconnected={() => {
              // Refresh / brief network blips disconnect LiveKit, don't kick the
              // doctor into wrap-up unless they pressed End call.
              if (endingCallRef.current) {
                void goPostConsult();
              }
            }}
            className="flex h-full min-h-0 flex-1 flex-col"
            style={{ height: '100%' }}
          >
            <EnableLocalMedia onHint={setMediaHint} />
            <LiveKitScribeController
              ref={scribeRef}
              enabled={scribeEnabled}
              onStateChange={setScribeState}
            />
            <TeleconsultStage
              patientName={appointment?.patientName || 'Patient'}
              doctorName={user?.displayName || 'You'}
              onEndCall={() => void handleEnd()}
              ending={ending || scribeFinalizing}
              mediaHint={
                scribeFinalizing
                  ? 'Ayah is drafting your consult note…'
                  : mediaHint
              }
            />
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
              disabled={notesStatus === 'saving' || scribeFinalizing}
              className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <div className="border-b border-white/10 px-3 py-3">
            <AyahScribePanel
              enabled={scribeEnabled}
              onEnabledChange={setScribeEnabled}
              listening={scribeState.listening}
              processing={scribeState.processing}
              segmentCount={scribeState.segmentCount}
              audioTrackCount={scribeState.audioTrackCount}
              transcriptPreview={scribeState.transcript.slice(-280)}
              error={scribeState.error}
            />
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
