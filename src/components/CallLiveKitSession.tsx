"use client";

import { useEffect, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import { ParticipantEvent, Track, type Room, type RoomOptions } from "livekit-client";
import "@livekit/components-styles";
import { loadDevicePreferences, type DevicePreferences } from "@/lib/devicePreferences";

type ActiveCall = { roomId: string; roomName: string; href: string };

/**
 * Everything that actually needs `@livekit/components-react` (a sizable
 * React wrapper) + its CSS + `livekit-client`'s runtime pieces beyond the
 * plain constants CallProvider.tsx needs unconditionally. Split out and
 * loaded via `next/dynamic({ssr:false})` from CallProvider so that bundle
 * cost is deferred until someone actually joins a call, instead of every
 * visitor paying for it on first load of anything under /bandos.
 */
export default function CallLiveKitSession({
  token,
  serverUrl,
  roomOptions,
  micEnabled,
  camOnJoin,
  devicePreferences,
  deafened,
  activeCall,
  roomRef,
  leaveCall,
  joinCall,
  setMicEnabled,
  setDeafened,
  setForceMuted,
  setForceDeafened,
  children,
}: {
  token: string;
  serverUrl: string;
  roomOptions: RoomOptions;
  micEnabled: boolean;
  camOnJoin: boolean;
  devicePreferences: DevicePreferences;
  deafened: boolean;
  activeCall: ActiveCall | null;
  roomRef: React.MutableRefObject<Room | null>;
  leaveCall: () => void;
  joinCall: (roomId: string, roomName: string, href: string) => void;
  setMicEnabled: (value: boolean) => void;
  setDeafened: (value: boolean) => void;
  setForceMuted: (value: boolean) => void;
  setForceDeafened: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      options={roomOptions}
      audio={
        !micEnabled
          ? false
          : devicePreferences.audioinput
            ? { deviceId: devicePreferences.audioinput }
            : true
      }
      video={
        !camOnJoin
          ? false
          : devicePreferences.videoinput
            ? { deviceId: devicePreferences.videoinput }
            : true
      }
      style={{ display: "contents" }}
      onDisconnected={leaveCall}
    >
      <RoomAudioRenderer />
      <CallRoomRef roomRef={roomRef} />
      <NoiseFilter />
      <CallDeviceSync
        micEnabled={micEnabled}
        deafened={deafened}
        activeCall={activeCall}
        setMicEnabled={setMicEnabled}
        setDeafened={setDeafened}
        setForceMuted={setForceMuted}
        setForceDeafened={setForceDeafened}
        joinCall={joinCall}
      />
      {children}
    </LiveKitRoom>
  );
}

/** Turns on LiveKit Cloud's Krisp-based noise cancellation for the local mic
 * as soon as it's published -- runs as a WASM track processor entirely in
 * the browser, on top of (not instead of) the browser's own
 * echoCancellation/noiseSuppression/autoGainControl (already on by default
 * for a plain `audio: true`/`{deviceId}` capture). This is the "supressão
 * de ruído" that was missing: those browser constraints handle echo/gain,
 * Krisp is what actually cuts background noise (keyboard, fan, other people
 * talking) the way Discord's own noise suppression does. No UI toggle for
 * now -- always on, same as it being unconditional in a real Discord call. */
function NoiseFilter() {
  const { setNoiseFilterEnabled } = useKrispNoiseFilter();
  const { microphoneTrack } = useLocalParticipant();

  useEffect(() => {
    if (microphoneTrack) setNoiseFilterEnabled(true);
  }, [microphoneTrack, setNoiseFilterEnabled]);

  return null;
}

function CallDeviceSync({
  micEnabled,
  deafened,
  activeCall,
  setMicEnabled,
  setDeafened,
  setForceMuted,
  setForceDeafened,
  joinCall,
}: {
  micEnabled: boolean;
  deafened: boolean;
  activeCall: ActiveCall | null;
  setMicEnabled: (value: boolean) => void;
  setDeafened: (value: boolean) => void;
  setForceMuted: (value: boolean) => void;
  setForceDeafened: (value: boolean) => void;
  joinCall: (roomId: string, roomName: string, href: string) => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const prevForceMutedRef = useRef(false);

  useEffect(() => {
    localParticipant.setMicrophoneEnabled(micEnabled).catch(() => {});
  }, [localParticipant, micEnabled]);

  useEffect(() => {
    remoteParticipants.forEach((p) => p.setVolume(deafened ? 0 : 1));
  }, [remoteParticipants, deafened]);

  // Server-side moderation signals (forced mute, moved to another channel)
  // arrive as attribute updates on our own participant.
  useEffect(() => {
    function handleAttributesChanged() {
      const attrs = localParticipant.attributes;

      const nowForceMuted = attrs.forceMuted === "true";
      setForceMuted(nowForceMuted);
      if (nowForceMuted) {
        setMicEnabled(false);
        // LocalParticipant reconciles its published tracks against every
        // ParticipantInfo update it receives from the server — if the
        // publication's own `isMuted` doesn't already agree with the
        // server-side mute LiveKit just applied (mutePublishedTrack), the
        // SDK "corrects" it by immediately telling the server to unmute
        // again. Muting the publication directly (not just flipping React
        // state, which only calls setMicrophoneEnabled on a later effect)
        // keeps that reconcile from fighting — and racing — the mod-mute.
        localParticipant
          .getTrackPublication(Track.Source.Microphone)
          ?.mute()
          .catch(() => {});
      } else if (prevForceMutedRef.current) {
        // Force-mute was just lifted. We muted the publication directly
        // above (not through setMicrophoneEnabled), so the effect that
        // syncs `micEnabled` never reruns on its own here — without this,
        // the publication stays muted forever and every future reconcile
        // keeps "correcting" the server back to muted, even after an
        // admin unmute. Re-sync it to whatever the user's own mic state
        // should be (usually still off, same as real Discord: lifting a
        // server mute doesn't turn your mic back on by itself).
        localParticipant.setMicrophoneEnabled(micEnabled).catch(() => {});
      }
      prevForceMutedRef.current = nowForceMuted;

      const nowForceDeafened = attrs.forceDeafened === "true";
      setForceDeafened(nowForceDeafened);
      if (nowForceDeafened) setDeafened(true);

      const movedToChannelId = attrs.movedToChannelId;
      const movedToChannelName = attrs.movedToChannelName;
      if (movedToChannelId && activeCall) {
        // The bando-scoped href always ends in the channel id — swap it for
        // the destination channel's id instead of replacing the whole path,
        // so this keeps working regardless of the /bandos/{bandoId}/ prefix.
        const nextHref = activeCall.href.replace(
          /[^/]+$/,
          movedToChannelId,
        );
        joinCall(
          movedToChannelId,
          movedToChannelName ?? "canal de voz",
          nextHref,
        );
      }
    }

    // Also check on attach, in case moderation landed moments before this
    // listener was wired up (e.g. right after joining).
    handleAttributesChanged();

    localParticipant.on(ParticipantEvent.AttributesChanged, handleAttributesChanged);
    return () => {
      localParticipant.off(
        ParticipantEvent.AttributesChanged,
        handleAttributesChanged,
      );
    };
  }, [
    localParticipant,
    activeCall,
    setForceMuted,
    setForceDeafened,
    setMicEnabled,
    setDeafened,
    joinCall,
    micEnabled,
  ]);

  useEffect(() => {
    localParticipant
      .setAttributes({ deafened: deafened ? "true" : "false" })
      .catch(() => {});
  }, [localParticipant, deafened]);

  return null;
}

/** Stashes the connected Room instance in a ref so setDevicePreference (which
 * lives outside the LiveKitRoom subtree) can hot-swap devices mid-call, and
 * applies the saved speaker preference once on connect -- there's no
 * join-time prop for audio output like there is for audio/video input. */
function CallRoomRef({ roomRef }: { roomRef: React.MutableRefObject<Room | null> }) {
  const room = useRoomContext();

  useEffect(() => {
    roomRef.current = room;
    const speakerId = loadDevicePreferences().audiooutput;
    if (speakerId) room.switchActiveDevice("audiooutput", speakerId).catch(() => {});
    return () => {
      roomRef.current = null;
    };
  }, [room, roomRef]);

  return null;
}
