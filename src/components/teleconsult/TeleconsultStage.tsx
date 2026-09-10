import React, { useEffect, useMemo, useState } from 'react';
import {
  ConnectionQualityIndicator,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import {
  ConnectionState,
  RemoteParticipant,
  RemoteTrackPublication,
  RoomEvent,
  Track,
} from 'livekit-client';
import type { Participant, TrackPublication } from 'livekit-client';
import type { TrackReference } from '@livekit/components-react';
import {
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react';

// React 19 JSX typing mismatch with LiveKit component packages
const VideoStream = VideoTrack as unknown as React.FC<{
  trackRef: TrackReference;
  className?: string;
  style?: React.CSSProperties;
}>;
const Quality = ConnectionQualityIndicator as unknown as React.FC<{
  participant: Participant;
  className?: string;
}>;

const VIDEO_FILL: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  background: '#12233c',
};

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

function Placeholder({
  name,
  caption,
  compact = false,
}: {
  name: string;
  caption: string;
  compact?: boolean;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#12233c]">
      <div
        className={`flex items-center justify-center rounded-full bg-white/10 font-semibold text-white ${
          compact ? 'h-12 w-12 text-sm' : 'h-24 w-24 text-2xl'
        }`}
      >
        {initialsOf(name)}
      </div>
      {!compact && (
        <div className="text-center px-6">
          <p className="text-base font-semibold text-white">{name}</p>
          <p className="mt-0.5 text-sm text-white/60">{caption}</p>
        </div>
      )}
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  tone = 'neutral',
  icon: Icon,
  activeIcon: ActiveIcon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: 'neutral' | 'danger';
  icon: React.ComponentType<{ className?: string }>;
  activeIcon: React.ComponentType<{ className?: string }>;
}) {
  const Rendered = active ? ActiveIcon : Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
        tone === 'danger'
          ? 'bg-red-500 text-white hover:bg-red-600'
          : active
            ? 'bg-white/15 text-white hover:bg-white/25'
            : 'bg-white/90 text-[#0E2340] hover:bg-white'
      }`}
    >
      <Rendered className="h-5 w-5" />
    </button>
  );
}

function asRemotePublication(
  publication: TrackPublication | undefined,
): RemoteTrackPublication | null {
  return publication instanceof RemoteTrackPublication ? publication : null;
}

function cameraRefForParticipant(participant: RemoteParticipant): TrackReference | null {
  const publication =
    participant.getTrackPublication(Track.Source.ScreenShare) ??
    participant.getTrackPublication(Track.Source.Camera);
  if (!publication) return null;
  return {
    participant,
    publication,
    source: publication.source,
  };
}

interface TeleconsultStageProps {
  patientName: string;
  doctorName: string;
  onEndCall: () => void;
  ending?: boolean;
  mediaHint?: string | null;
}

/**
 * Patient fills the stage, the doctor rides along in a picture-in-picture, and
 * the call controls stay pinned so they never scroll out of reach.
 */
export const TeleconsultStage: React.FC<TeleconsultStageProps> = ({
  patientName,
  doctorName,
  onEndCall,
  ending = false,
  mediaHint = null,
}) => {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });
  const [selfViewHidden, setSelfViewHidden] = useState(false);
  // Force a re-render when remote publications change outside useTracks.
  const [, setPubTick] = useState(0);

  useEffect(() => {
    if (!room) return;
    const bump = () => setPubTick((n) => n + 1);
    room
      .on(RoomEvent.TrackPublished, bump)
      .on(RoomEvent.TrackUnpublished, bump)
      .on(RoomEvent.TrackSubscribed, bump)
      .on(RoomEvent.TrackUnsubscribed, bump)
      .on(RoomEvent.TrackMuted, bump)
      .on(RoomEvent.TrackUnmuted, bump)
      .on(RoomEvent.ParticipantConnected, bump)
      .on(RoomEvent.ParticipantDisconnected, bump);
    return () => {
      room
        .off(RoomEvent.TrackPublished, bump)
        .off(RoomEvent.TrackUnpublished, bump)
        .off(RoomEvent.TrackSubscribed, bump)
        .off(RoomEvent.TrackUnsubscribed, bump)
        .off(RoomEvent.TrackMuted, bump)
        .off(RoomEvent.TrackUnmuted, bump)
        .off(RoomEvent.ParticipantConnected, bump)
        .off(RoomEvent.ParticipantDisconnected, bump);
    };
  }, [room]);

  // Prefer the live participant map, useTracks can lag behind mobile publishes.
  const remoteStage = useMemo(() => {
    for (const participant of remoteParticipants) {
      const fromParticipant = cameraRefForParticipant(participant);
      if (fromParticipant) return fromParticipant;
    }
    const fromHook = tracks.find(
      (track): track is TrackReference =>
        isTrackReference(track) && !track.participant.isLocal,
    );
    return fromHook ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteParticipants, tracks, room?.remoteParticipants.size]);

  const localCamera = useMemo(
    () =>
      tracks.find(
        (track): track is TrackReference =>
          isTrackReference(track) &&
          track.participant.isLocal &&
          track.source === Track.Source.Camera,
      ) ?? null,
    [tracks],
  );

  // Always ask for remote camera / screen-share, including publications that
  // arrived before this client finished connecting.
  useEffect(() => {
    remoteParticipants.forEach((participant) => {
      participant.getTrackPublications().forEach((publication) => {
        const remote = asRemotePublication(publication);
        if (
          remote &&
          (remote.source === Track.Source.Camera ||
            remote.source === Track.Source.ScreenShare) &&
          !remote.isSubscribed
        ) {
          remote.setSubscribed(true);
        }
      });
    });
  }, [remoteParticipants, remoteStage]);

  const remoteJoined = remoteParticipants.length > 0;
  const remoteCameraOff =
    remoteStage != null &&
    remoteStage.source === Track.Source.Camera &&
    (remoteStage.publication.isMuted || !remoteStage.participant.isCameraEnabled);
  const remoteVideoReady = remoteStage != null && isTrackReference(remoteStage);

  const stageCaption = !remoteJoined
    ? 'Waiting for the patient to join…'
    : remoteCameraOff
      ? 'Camera is off'
      : 'Patient joined, waiting for their camera…';

  const connectionNotice =
    connectionState === ConnectionState.Connecting
      ? 'Connecting…'
      : connectionState === ConnectionState.Reconnecting
        ? 'Reconnecting…'
        : connectionState === ConnectionState.Disconnected
          ? 'Disconnected'
          : null;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#0B1B30]">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {remoteVideoReady && remoteStage ? (
          <VideoStream trackRef={remoteStage} style={VIDEO_FILL} className="absolute inset-0" />
        ) : (
          <Placeholder name={patientName} caption={stageCaption} />
        )}

        {remoteVideoReady && remoteCameraOff && (
          <div className="pointer-events-none absolute inset-0">
            <Placeholder name={patientName} caption="Camera is off" />
          </div>
        )}

        {(connectionNotice || mediaHint) && (
          <div className="absolute left-1/2 top-4 z-10 flex max-w-[90%] -translate-x-1/2 flex-col items-center gap-2">
            {connectionNotice && (
              <div className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
                {connectionNotice}
              </div>
            )}
            {mediaHint && (
              <div className="rounded-full bg-amber-500/90 px-3 py-1.5 text-center text-xs font-semibold text-white">
                {mediaHint}
              </div>
            )}
          </div>
        )}

        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5">
          <span className="text-xs font-semibold text-white">{patientName}</span>
          {remoteParticipants[0] && (
            <Quality participant={remoteParticipants[0]} className="text-white" />
          )}
        </div>

        {!selfViewHidden && (
          <div className="absolute bottom-4 right-4 z-10 h-[132px] w-[190px] overflow-hidden rounded-xl border border-white/15 bg-[#12233c] shadow-lg sm:h-[160px] sm:w-[232px]">
            {isCameraEnabled && localCamera ? (
              <VideoStream
                trackRef={localCamera}
                style={{ ...VIDEO_FILL, transform: 'scaleX(-1)' }}
              />
            ) : (
              <Placeholder name={doctorName} caption="Camera off" compact />
            )}
            <span className="absolute bottom-1.5 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
              You
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setSelfViewHidden((hidden) => !hidden)}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/70"
        >
          {selfViewHidden ? 'Show self view' : 'Hide self view'}
        </button>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-[#0B1B30] px-4 py-3">
        <ControlButton
          active={isMicrophoneEnabled}
          onClick={() =>
            void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(() => undefined)
          }
          label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          icon={MicOff}
          activeIcon={Mic}
        />
        <ControlButton
          active={isCameraEnabled}
          onClick={() =>
            void localParticipant.setCameraEnabled(!isCameraEnabled).catch(() => undefined)
          }
          label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          icon={VideoOff}
          activeIcon={Video}
        />
        <ControlButton
          active={isScreenShareEnabled}
          onClick={() =>
            void localParticipant
              .setScreenShareEnabled(!isScreenShareEnabled)
              .catch(() => undefined)
          }
          label={isScreenShareEnabled ? 'Stop sharing screen' : 'Share screen'}
          icon={MonitorOff}
          activeIcon={Monitor}
        />
        <button
          type="button"
          onClick={onEndCall}
          disabled={ending}
          className="ml-2 inline-flex h-11 items-center gap-2 rounded-full bg-red-500 px-5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
        >
          <PhoneOff className="h-4 w-4" />
          {ending ? 'Ending…' : 'End call'}
        </button>
      </div>
    </div>
  );
};

export default TeleconsultStage;
