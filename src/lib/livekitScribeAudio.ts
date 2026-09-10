import {
  LocalParticipant,
  RemoteParticipant,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
} from 'livekit-client';

type MixerHandle = {
  stream: MediaStream;
  trackCount: number;
  resume: () => void;
  dispose: () => void;
};

function publicationAudioTrack(
  publication: LocalTrackPublication | RemoteTrackPublication,
): MediaStreamTrack | null {
  const track = publication.track;
  if (!track || track.kind !== Track.Kind.Audio) return null;
  return track.mediaStreamTrack ?? null;
}

function attachParticipantAudio(
  participant: LocalParticipant | RemoteParticipant,
  audioContext: AudioContext,
  destination: MediaStreamAudioDestinationNode,
  nodes: MediaStreamAudioSourceNode[],
  seen: Set<string>,
): number {
  let added = 0;
  participant.audioTrackPublications.forEach((publication) => {
    const mediaTrack = publicationAudioTrack(publication);
    if (!mediaTrack || seen.has(mediaTrack.id)) return;
    seen.add(mediaTrack.id);
    const stream = new MediaStream([mediaTrack]);
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(destination);
    nodes.push(source);
    added += 1;
  });
  return added;
}

/** Mix all LiveKit room audio (local + remote) into one MediaStream for scribe capture. */
export function createLiveKitMixedAudioStream(room: Room): MixerHandle {
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  const nodes: MediaStreamAudioSourceNode[] = [];
  const seen = new Set<string>();

  const rebuild = () => {
    nodes.forEach((node) => node.disconnect());
    nodes.length = 0;
    seen.clear();
    attachParticipantAudio(room.localParticipant, audioContext, destination, nodes, seen);
    room.remoteParticipants.forEach((participant) => {
      attachParticipantAudio(participant, audioContext, destination, nodes, seen);
    });
  };

  rebuild();

  const onTrackChange = () => {
    rebuild();
  };

  room.on(RoomEvent.TrackSubscribed, onTrackChange);
  room.on(RoomEvent.TrackUnsubscribed, onTrackChange);
  room.on(RoomEvent.TrackMuted, onTrackChange);
  room.on(RoomEvent.TrackUnmuted, onTrackChange);
  room.on(RoomEvent.ParticipantConnected, onTrackChange);
  room.on(RoomEvent.ParticipantDisconnected, onTrackChange);
  room.on(RoomEvent.LocalTrackPublished, onTrackChange);
  room.on(RoomEvent.LocalTrackUnpublished, onTrackChange);

  return {
    stream: destination.stream,
    get trackCount() {
      return seen.size;
    },
    resume: () => {
      if (audioContext.state === 'suspended') {
        void audioContext.resume();
      }
    },
    dispose: () => {
      room.off(RoomEvent.TrackSubscribed, onTrackChange);
      room.off(RoomEvent.TrackUnsubscribed, onTrackChange);
      room.off(RoomEvent.TrackMuted, onTrackChange);
      room.off(RoomEvent.TrackUnmuted, onTrackChange);
      room.off(RoomEvent.ParticipantConnected, onTrackChange);
      room.off(RoomEvent.ParticipantDisconnected, onTrackChange);
      room.off(RoomEvent.LocalTrackPublished, onTrackChange);
      room.off(RoomEvent.LocalTrackUnpublished, onTrackChange);
      nodes.forEach((node) => node.disconnect());
      void audioContext.close();
    },
  };
}

/** Ensure remote participants publish/subscribe audio for scribe mixing. */
export function ensureRemoteAudioSubscribed(room: Room): void {
  room.remoteParticipants.forEach((participant) => {
    participant.audioTrackPublications.forEach((publication) => {
      if (publication instanceof RemoteTrackPublication && !publication.isSubscribed) {
        publication.setSubscribed(true);
      }
    });
  });
}
