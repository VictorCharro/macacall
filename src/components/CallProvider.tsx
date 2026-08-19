"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
} from "@livekit/components-react";
import { ParticipantEvent } from "livekit-client";
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
    setDeafened((prev) => {
      const next = !prev;
      setMicEnabled(!next);
      return next;
    });
  }, []);

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
            setForceMuted={setForceMuted}
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
  setForceMuted,
  joinCall,
}: {
  micEnabled: boolean;
  deafened: boolean;
  activeCall: ActiveCall | null;
  setMicEnabled: (value: boolean) => void;
  setForceMuted: (value: boolean) => void;
  joinCall: (roomId: string, roomName: string, href: string) => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

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
      if (nowForceMuted) setMicEnabled(false);

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
  }, [localParticipant, activeCall, setForceMuted, setMicEnabled, joinCall]);

  useEffect(() => {
    localParticipant
      .setAttributes({ deafened: deafened ? "true" : "false" })
      .catch(() => {});
  }, [localParticipant, deafened]);

  return null;
}
