"use client";

import { useEffect, useState } from "react";

type Participant = { identity: string; name: string };

export function VoiceChannelPresence({ bandoId }: { bandoId: string }) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/livekit/participants?bandoId=${bandoId}`);
        const data = await res.json();
        if (!cancelled) setParticipants(data.participants ?? []);
      } catch {
        // silencioso: a call ainda funciona mesmo sem essa lista
      }
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bandoId]);

  if (participants.length === 0) {
    return <p className="text-sm text-muted">Ninguém na call agora 🍃</p>;
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {participants.map((p) => (
        <span
          key={p.identity}
          className="flex items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-sm font-medium text-secondary"
        >
          🐵 {p.name}
        </span>
      ))}
    </div>
  );
}
