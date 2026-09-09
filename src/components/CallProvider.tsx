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
import dynamic from "next/dynamic";
import { ConnectionState, type Room } from "livekit-client";
import {
  applyVideoQualityLive,
  buildRoomOptions,
  loadVideoQuality,
  saveVideoQuality,
  type VideoQuality,
} from "@/lib/callQuality";
import {
  loadDevicePreferences,
  DEVICE_PREFS_KEY,
  type DeviceKind,
  type DevicePreferences,
} from "@/lib/devicePreferences";

export type { DeviceKind, DevicePreferences };

// The actual `@livekit/components-react` tree (+ its CSS + livekit-client's
// heavier runtime pieces) only loads once someone actually joins a call,
// instead of every visitor paying for that bundle on first load of
// anything under /bandos. See CallLiveKitSession.tsx.
const CallLiveKitSession = dynamic(() => import("@/components/CallLiveKitSession"), {
  ssr: false,
});

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
  devicePreferences: DevicePreferences;
  /** Persists the choice and, if a call is active, hot-swaps the live track. */
  setDevicePreference: (kind: DeviceKind, deviceId: string) => void;
  videoQuality: VideoQuality;
  /** Persists the choice and, if a call is active, applies it live (see
   * `applyVideoQualityLive` -- renegotiates bitrate/audio in place, only
   * restarts the camera capture itself, never the room connection). */
  setVideoQuality: (quality: VideoQuality) => void;
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
  const [devicePreferences, setDevicePreferences] = useState<DevicePreferences>(
    loadDevicePreferences,
  );
  const [videoQuality, setVideoQualityState] = useState<VideoQuality>(loadVideoQuality);
  const roomRef = useRef<Room | null>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);
  const devicePreferencesRef = useRef<DevicePreferences>(devicePreferences);
  useEffect(() => {
    devicePreferencesRef.current = devicePreferences;
  }, [devicePreferences]);

  const setDevicePreference = useCallback((kind: DeviceKind, deviceId: string) => {
    setDevicePreferences((prev) => {
      const next = { ...prev, [kind]: deviceId };
      localStorage.setItem(DEVICE_PREFS_KEY, JSON.stringify(next));
      return next;
    });
    roomRef.current?.switchActiveDevice(kind, deviceId).catch(() => {});
  }, []);

  const setVideoQuality = useCallback(
    (quality: VideoQuality) => {
      setVideoQualityState(quality);
      saveVideoQuality(quality);
      const room = roomRef.current;
      if (room && room.state === ConnectionState.Connected) {
        applyVideoQualityLive(room, quality, devicePreferencesRef.current).catch(() => {});
      }
    },
    [],
  );

  const roomOptions = useMemo(() => buildRoomOptions(videoQuality), [videoQuality]);

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

  // Tracks the most recently requested room so a slow/stale token fetch
  // (e.g. from a move that's since been followed by another) can't clobber
  // a newer one landing first.
  const joinRequestRef = useRef(0);

  const joinCall = useCallback(
    async (
      roomId: string,
      roomName: string,
      href: string,
      options?: { camera?: boolean },
    ) => {
      // Clicking the voice channel you're already in shouldn't tear the
      // connection down and rebuild it -- Discord just brings the view back
      // into focus.
      if (activeCallRef.current?.roomId === roomId) return;

      setError(null);
      setCamOnJoin(Boolean(options?.camera));
      const requestId = ++joinRequestRef.current;

      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha ao entrar na call");
        if (joinRequestRef.current !== requestId) return; // superseded

        // Room.connect() is a no-op while already Connected -- it just logs
        // "already connected to room X" and resolves without switching. So
        // simply changing the `token`/`serverUrl` props on the persisting
        // LiveKitRoom (see the note below on why we keep it mounted) is not
        // enough on its own: the client silently stays in the OLD room even
        // though our own UI has already moved on, which is exactly the
        // "still shows me in the old call" bug this once caused. Has to be
        // disconnected explicitly first so the room is back in a state
        // where connect() will actually do something.
        if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
          await roomRef.current.disconnect();
        }
        if (joinRequestRef.current !== requestId) return; // superseded meanwhile

        // Setting both together in the same tick means `connected` (derived
        // from activeCall+tokenInfo agreeing) never dips to false in
        // between -- LiveKitRoom stays mounted across the switch and just
        // reconnects to the new room/token instead of fully unmounting and
        // rebuilding the whole peer connection from scratch, which is what
        // made moving between channels feel like a multi-second dropout.
        setTokenInfo({ roomId, token: data.token, serverUrl: data.url });
        setActiveCall({ roomId, roomName, href });
      } catch (err) {
        if (joinRequestRef.current === requestId) {
          setError(err instanceof Error ? err.message : "Falha ao entrar na call");
        }
      }
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
      devicePreferences,
      setDevicePreference,
      videoQuality,
      setVideoQuality,
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
      devicePreferences,
      setDevicePreference,
      videoQuality,
      setVideoQuality,
    ],
  );

  if (connected) {
    return (
      <CallContext.Provider value={value}>
        <CallLiveKitSession
          token={tokenInfo!.token}
          serverUrl={tokenInfo!.serverUrl}
          roomOptions={roomOptions}
          micEnabled={micEnabled}
          camOnJoin={camOnJoin}
          devicePreferences={devicePreferences}
          deafened={deafened}
          activeCall={activeCall}
          roomRef={roomRef}
          leaveCall={leaveCall}
          joinCall={joinCall}
          setMicEnabled={setMicEnabled}
          setDeafened={setDeafened}
          setForceMuted={setForceMuted}
          setForceDeafened={setForceDeafened}
        >
          {children}
        </CallLiveKitSession>
      </CallContext.Provider>
    );
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
