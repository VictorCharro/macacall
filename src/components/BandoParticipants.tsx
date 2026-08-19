"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type BandoParticipant = {
  identity: string;
  name: string;
  channelId: string;
  sharingScreen: boolean;
  micMuted: boolean;
  deafened: boolean;
  forceMuted: boolean;
};

const BandoParticipantsContext = createContext<BandoParticipant[]>([]);

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

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bandoId]);

  return (
    <BandoParticipantsContext.Provider value={participants}>
      {children}
    </BandoParticipantsContext.Provider>
  );
}

export function useBandoParticipants() {
  return useContext(BandoParticipantsContext);
}
