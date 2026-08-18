"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";

type ActiveCall = { bandoId: string; channelId: string; channelName: string };

type CallContextValue = {
  activeCall: ActiveCall | null;
  connected: boolean;
  error: string | null;
  joinCall: (bandoId: string, channelId: string, channelName: string) => void;
  leaveCall: () => void;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{
    channelId: string;
    token: string;
    serverUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const joinCall = useCallback(
    (bandoId: string, channelId: string, channelName: string) => {
      setError(null);
      setActiveCall({ bandoId, channelId, channelName });
    },
    [],
  );

  const leaveCall = useCallback(() => {
    if (
      activeCall &&
      pathname === `/bandos/${activeCall.bandoId}/${activeCall.channelId}`
    ) {
      router.push(`/bandos/${activeCall.bandoId}`);
    }
    setActiveCall(null);
    setTokenInfo(null);
    setError(null);
  }, [activeCall, pathname, router]);

  useEffect(() => {
    if (!activeCall) return;
    let cancelled = false;
    const channelId = activeCall.channelId;

    fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha ao entrar na call");
        if (!cancelled) {
          setTokenInfo({ channelId, token: data.token, serverUrl: data.url });
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
    activeCall && tokenInfo && tokenInfo.channelId === activeCall.channelId,
  );

  const value = useMemo<CallContextValue>(
    () => ({ activeCall, connected, error, joinCall, leaveCall }),
    [activeCall, connected, error, joinCall, leaveCall],
  );

  if (connected) {
    return (
      <CallContext.Provider value={value}>
        <LiveKitRoom
          token={tokenInfo!.token}
          serverUrl={tokenInfo!.serverUrl}
          connect
          audio
          video={false}
          style={{ display: "contents" }}
          onDisconnected={leaveCall}
        >
          <RoomAudioRenderer />
          {children}
        </LiveKitRoom>
      </CallContext.Provider>
    );
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
