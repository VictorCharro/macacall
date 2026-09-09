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
import { createClient } from "@/lib/supabase/client";

export type BandoParticipant = {
  identity: string;
  name: string;
  channelId: string;
  avatarSeed: string;
  avatarUrl: string | null;
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
 *
 * Two things soften how much this polls in practice:
 *  1. Paused while the tab isn't visible (Page Visibility API) -- a
 *     backgrounded tab has no reason to keep hitting this every few
 *     seconds, and it re-fetches immediately on becoming visible again
 *     so the view isn't stale when you come back.
 *  2. `api/livekit/webhook` relays LiveKit room activity (participant
 *     joined/left, track published/unpublished) into a Supabase Realtime
 *     broadcast per voice channel id, so most changes trigger an
 *     immediate `poll()` instead of waiting for the next tick. The
 *     interval itself is turned way down (was 4s) since it's now a
 *     fallback for when the webhook isn't configured on the LiveKit
 *     project yet, or a broadcast doesn't land -- not the primary path.
 */
export function BandoParticipantsProvider({
  bandoId,
  voiceChannelIds,
  children,
}: {
  bandoId: string;
  voiceChannelIds: string[];
  children: React.ReactNode;
}) {
  const [participants, setParticipants] = useState<BandoParticipant[]>([]);
  const pollRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.hidden) return;
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
    const interval = setInterval(poll, 15000);

    function onVisibilityChange() {
      if (!document.hidden) poll();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [bandoId]);

  // Best-effort fast path -- see the webhook route for why this can
  // silently do nothing (no webhook configured yet, or the broadcast
  // doesn't land) without breaking anything: the poll above still covers
  // it either way.
  useEffect(() => {
    if (voiceChannelIds.length === 0) return;

    const supabase = createClient();
    const channels = voiceChannelIds.map((channelId) =>
      supabase
        .channel(`voice-activity:${channelId}`)
        .on("broadcast", { event: "changed" }, () => pollRef.current())
        .subscribe(),
    );

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceChannelIds.join(",")]);

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
