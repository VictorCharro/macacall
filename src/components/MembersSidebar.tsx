"use client";

import { useMemo } from "react";
import { Crown, Mic } from "lucide-react";
import { useBandoParticipants } from "@/components/BandoParticipants";

type Member = {
  id: string;
  username: string;
  avatarSeed: string;
  isOwner: boolean;
};

export function MembersSidebar({
  members,
  voiceChannelNames,
}: {
  bandoId: string;
  members: Member[];
  voiceChannelNames: Record<string, string>;
}) {
  const participants = useBandoParticipants();
  const inCall = useMemo(
    () => new Map(participants.map((p) => [p.identity, p.channelId])),
    [participants],
  );

  const leaders = members.filter((m) => m.isOwner);
  const others = members.filter((m) => !m.isOwner);

  const renderGroup = (title: string, list: Member[]) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-1">
        <div className="px-2 py-1 text-[11px] font-bold tracking-wider text-muted">
          {title} — {list.length}
        </div>
        {list.map((member) => {
          const channelId = inCall.get(member.id);
          const channelName = channelId ? voiceChannelNames[channelId] : null;
          return (
            <div
              key={member.id}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-card-2"
            >
              <img
                src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(member.avatarSeed)}`}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full border border-border-soft bg-background"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-xs font-bold text-foreground">
                  {member.username}
                  {member.isOwner && <Crown className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </p>
                {channelName ? (
                  <p className="flex items-center gap-1 truncate text-[11px] font-medium text-secondary">
                    <Mic className="h-3 w-3 shrink-0" />
                    Em {channelName}
                  </p>
                ) : (
                  <p className="truncate text-[10px] text-muted">Na selva</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-4 overflow-y-auto overflow-x-hidden border-l border-border-soft bg-card p-3 sm:flex">
      {renderGroup("Dono do bando", leaders)}
      {renderGroup("Membros", others)}
    </aside>
  );
}
