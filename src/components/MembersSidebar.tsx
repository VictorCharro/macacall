"use client";

import { useEffect, useState } from "react";

type Member = {
  id: string;
  username: string;
  avatarSeed: string;
  isOwner: boolean;
};

type Participant = { identity: string; name: string; channelId: string };

export function MembersSidebar({
  bandoId,
  members,
  voiceChannelNames,
}: {
  bandoId: string;
  members: Member[];
  voiceChannelNames: Record<string, string>;
}) {
  const [inCall, setInCall] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/livekit/participants?bandoId=${bandoId}`);
        const data = await res.json();
        if (!cancelled) {
          const participants: Participant[] = data.participants ?? [];
          setInCall(
            new Map(participants.map((p) => [p.identity, p.channelId])),
          );
        }
      } catch {
        // silencioso: a lista de membros ainda funciona sem essa info
      }
    }

    poll();
    const interval = setInterval(poll, 2000);
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
        {members.map((member) => {
          const channelId = inCall.get(member.id);
          const channelName = channelId ? voiceChannelNames[channelId] : null;
          return (
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
                {channelName && (
                  <p className="truncate text-xs font-medium text-secondary">
                    🎙️ Em {channelName}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
