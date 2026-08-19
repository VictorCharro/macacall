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

export type BandoParticipant = {
  identity: string;
  name: string;
  channelId: string;
  sharingScreen: boolean;
  micMuted: boolean;
  deafened: boolean;
  forceMuted: boolean;
  forceDeafened: boolean;
};

type BandoParticipantsContextValue = {
  participants: BandoParticipant[];
  refresh: () => void;
};

const BandoParticipantsContext = createContext<BandoParticipantsContextValue>({
  participants: [],
  refresh: () => {},
});

/**
 * Single shared poll of /api/livekit/participants per bando, so sibling
 * components (channel sidebar, members sidebar) don't each run their own
 * interval against the same endpoint.
 */
export function BandoParticipantsProvider({
  bandoId,
  children,
}: {
  bandoId: string;
  children: React.ReactNode;
}) {
  const [participants, setParticipants] = useState<BandoParticipant[]>([]);
  const pollRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/livekit/participants?bandoId=${bandoId}`);
        const data = await res.json();
        if (!cancelled) setParticipants(data.participants ?? []);
      } catch {
        // silencioso: a UI ainda funciona sem essa info
      }
    }

    pollRef.current = poll;
    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bandoId]);

  // Lets moderation actions (mute/move) force an immediate re-fetch instead
  // of waiting up to 4s for the next scheduled tick.
  const refresh = useCallback(() => {
    pollRef.current();
  }, []);

  const value = useMemo(() => ({ participants, refresh }), [participants, refresh]);

  return (
    <BandoParticipantsContext.Provider value={value}>
      {children}
    </BandoParticipantsContext.Provider>
  );
}

export function useBandoParticipants() {
  return useContext(BandoParticipantsContext).participants;
}

export function useRefreshBandoParticipants() {
  return useContext(BandoParticipantsContext).refresh;
}
