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
import "@livekit/components-styles";

type ActiveCall = { roomId: string; roomName: string; href: string };

type CallContextValue = {
  activeCall: ActiveCall | null;
  connected: boolean;
  error: string | null;
  micEnabled: boolean;
  deafened: boolean;
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

  const toggleMic = useCallback(() => {
    setMicEnabled((prev) => {
      const next = !prev;
      if (next) setDeafened(false);
      return next;
    });
  }, []);

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
          <CallDeviceSync micEnabled={micEnabled} deafened={deafened} />
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
}: {
  micEnabled: boolean;
  deafened: boolean;
}) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  useEffect(() => {
    localParticipant.setMicrophoneEnabled(micEnabled).catch(() => {});
  }, [localParticipant, micEnabled]);

  useEffect(() => {
    remoteParticipants.forEach((p) => p.setVolume(deafened ? 0 : 1));
  }, [remoteParticipants, deafened]);

  useEffect(() => {
    localParticipant
      .setAttributes({ deafened: deafened ? "true" : "false" })
      .catch(() => {});
  }, [localParticipant, deafened]);

  return null;
}
