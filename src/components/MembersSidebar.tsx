"use client";

import { useEffect, useState } from "react";

type Member = {
  id: string;
  username: string;
  avatarSeed: string;
  isOwner: boolean;
};

export function MembersSidebar({
  bandoId,
  members,
}: {
  bandoId: string;
  members: Member[];
}) {
  const [inCall, setInCall] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/livekit/participants?bandoId=${bandoId}`);
        const data = await res.json();
        if (!cancelled) {
          setInCall(
            new Set(
              (data.participants ?? []).map(
                (p: { identity: string }) => p.identity,
              ),
            ),
          );
        }
      } catch {
        // silencioso: a lista de membros ainda funciona sem essa info
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
    <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-l border-border bg-card/60 p-4 sm:flex">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Membros — {members.length}
      </h2>
      <ul className="flex flex-col gap-1">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-border/40"
          >
            <img
              src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(member.avatarSeed)}`}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full bg-background"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {member.username}
                {member.isOwner && " 👑"}
              </p>
              {inCall.has(member.id) && (
                <p className="text-xs font-medium text-secondary">
                  🎙️ Em canal de voz
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
