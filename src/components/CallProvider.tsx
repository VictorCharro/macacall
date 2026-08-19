"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
} from "@livekit/components-react";
import { ParticipantEvent, Track } from "livekit-client";
import "@livekit/components-styles";

type ActiveCall = { roomId: string; roomName: string; href: string };

type CallContextValue = {
  activeCall: ActiveCall | null;
  connected: boolean;
  error: string | null;
  micEnabled: boolean;
  deafened: boolean;
  /** Muted by a moderator (MUTE_MEMBERS), not by the user's own choice. */
  forceMuted: boolean;
  /** Deafened by a moderator (DEAFEN_MEMBERS), not by the user's own choice. */
  forceDeafened: boolean;
  joinCall: (
    roomId: string,
    roomName: string,
    href: string,
    options?: { camera?: boolean },
  ) => void;
  leaveCall: () => void;
  toggleMic: () => void;
  toggleDeafen: () => void;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [camOnJoin, setCamOnJoin] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{
    roomId: string;
    token: string;
    serverUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [deafened, setDeafened] = useState(false);
  const [forceMuted, setForceMuted] = useState(false);
  const [forceDeafened, setForceDeafened] = useState(false);

  const toggleMic = useCallback(() => {
    // A moderator mute can only be lifted by the moderator (or by leaving and
    // rejoining the call) — mirrors how a real Discord server mute works.
    setMicEnabled((prev) => {
      if (forceMuted) return prev;
      const next = !prev;
      if (next) setDeafened(false);
      return next;
    });
  }, [forceMuted]);

  const toggleDeafen = useCallback(() => {
    // Same idea as forceMuted: a moderator deafen can only be lifted by the
    // moderator (or by leaving and rejoining the call).
    setDeafened((prev) => {
      if (forceDeafened) return prev;
      const next = !prev;
      setMicEnabled(!next);
      return next;
    });
  }, [forceDeafened]);

  const joinCall = useCallback(
    (
      roomId: string,
      roomName: string,
      href: string,
      options?: { camera?: boolean },
    ) => {
      setError(null);
      setCamOnJoin(Boolean(options?.camera));
      setActiveCall({ roomId, roomName, href });
    },
    [],
  );

  const leaveCall = useCallback(() => {
    setActiveCall(null);
    setTokenInfo(null);
    setError(null);
    setForceMuted(false);
    setForceDeafened(false);
  }, []);

  useEffect(() => {
    if (!activeCall) return;
    let cancelled = false;
    const roomId = activeCall.roomId;

    fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha ao entrar na call");
        if (!cancelled) {
          setTokenInfo({ roomId, token: data.token, serverUrl: data.url });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [activeCall]);

  const connected = Boolean(
    activeCall && tokenInfo && tokenInfo.roomId === activeCall.roomId,
  );

  const value = useMemo<CallContextValue>(
    () => ({
      activeCall,
      connected,
      error,
      micEnabled,
      deafened,
      forceMuted,
      forceDeafened,
      joinCall,
      leaveCall,
      toggleMic,
      toggleDeafen,
    }),
    [
      activeCall,
      connected,
      error,
      micEnabled,
      deafened,
      forceMuted,
      forceDeafened,
      joinCall,
      leaveCall,
      toggleMic,
      toggleDeafen,
    ],
  );

  if (connected) {
    return (
      <CallContext.Provider value={value}>
        <LiveKitRoom
          token={tokenInfo!.token}
          serverUrl={tokenInfo!.serverUrl}
          connect
          audio={micEnabled}
          video={camOnJoin}
          style={{ display: "contents" }}
          onDisconnected={leaveCall}
        >
          <RoomAudioRenderer />
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
      </CallContext.Provider>
    );
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
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
