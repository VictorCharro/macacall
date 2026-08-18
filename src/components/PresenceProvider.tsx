"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { updateStatus } from "@/app/actions/friends";
import type { PresenceStatus } from "@/lib/types";

type PresenceContextValue = {
  online: Map<string, PresenceStatus>;
  myStatus: PresenceStatus;
  setMyStatus: (status: PresenceStatus) => void;
};

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error("usePresence must be used inside PresenceProvider");
  return ctx;
}

export function PresenceProvider({
  userId,
  initialStatus,
  children,
}: {
  userId: string;
  initialStatus: PresenceStatus;
  children: React.ReactNode;
}) {
  const [online, setOnline] = useState<Map<string, PresenceStatus>>(new Map());
  const [myStatus, setMyStatusState] = useState<PresenceStatus>(initialStatus);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ status: PresenceStatus }>();
        const map = new Map<string, PresenceStatus>();
        Object.entries(state).forEach(([key, entries]) => {
          if (entries[0]) map.set(key, entries[0].status);
        });
        setOnline(map);
      })
      .subscribe((subStatus) => {
        if (subStatus === "SUBSCRIBED") {
          channel.track({ status: myStatus });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    channelRef.current?.track({ status: myStatus });
  }, [myStatus]);

  function setMyStatus(status: PresenceStatus) {
    setMyStatusState(status);
    updateStatus(status);
  }

  return (
    <PresenceContext.Provider value={{ online, myStatus, setMyStatus }}>
      {children}
    </PresenceContext.Provider>
  );
}
