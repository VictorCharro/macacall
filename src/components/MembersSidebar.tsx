"use client";

import { useMemo, useState } from "react";
import { Crown, Mic, X, MessageSquare } from "lucide-react";
import { useBandoParticipants } from "@/components/BandoParticipants";
import { useMembersPanel } from "@/components/MembersPanelProvider";
import { usePresence } from "@/components/PresenceProvider";
import { STATUS_META } from "@/lib/presence";
import { colorFromSeed } from "@/lib/colorFromSeed";
import { startDm } from "@/app/actions/dms";
import type { PresenceStatus } from "@/lib/types";

type Member = {
  id: string;
  username: string;
  avatarSeed: string;
  isOwner: boolean;
  statusMessage: string | null;
  bio: string | null;
  bannerColor: string | null;
};

export function MembersSidebar({
  members,
  voiceChannelNames,
  currentUserId,
}: {
  bandoId: string;
  members: Member[];
  voiceChannelNames: Record<string, string>;
  currentUserId: string;
}) {
  const participants = useBandoParticipants();
  const { membersOpen } = useMembersPanel();
  const { online } = usePresence();
  const [selected, setSelected] = useState<Member | null>(null);

  const inCall = useMemo(
    () => new Map(participants.map((p) => [p.identity, p.channelId])),
    [participants],
  );

  if (!membersOpen) return null;

  // Anyone not broadcasting presence is offline; "invisible" is deliberately
  // indistinguishable from offline to everyone but the person themselves.
  const statusOf = (id: string): PresenceStatus | "offline" => {
    const status = online.get(id);
    if (!status || status === "invisible") return "offline";
    return status;
  };

  const owners = members.filter((m) => m.isOwner);
  const others = members.filter((m) => !m.isOwner);

  const renderGroup = (title: string, list: Member[], colorClass: string) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-1">
        <div
          className={`px-2 py-1 text-[11px] font-bold tracking-wider ${colorClass}`}
        >
          {title} — {list.length}
        </div>

        {list.map((member) => {
          const channelId = inCall.get(member.id);
          const channelName = channelId ? voiceChannelNames[channelId] : null;
          const status = statusOf(member.id);

          return (
            <button
              key={member.id}
              type="button"
              onClick={() => setSelected(member)}
              className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-card-2"
            >
              <div className="relative shrink-0">
                <img
                  src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(member.avatarSeed)}`}
                  alt=""
                  className="h-8 w-8 rounded-full border border-border bg-card-3"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                    status === "offline" ? "bg-muted" : STATUS_META[status].dotClass
                  }`}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-xs font-bold text-foreground group-hover:text-accent">
                  {member.username}
                  {member.isOwner && (
                    <Crown className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </p>
                {channelName ? (
                  <p className="flex items-center gap-1 truncate text-[10px] font-medium text-secondary">
                    <Mic className="h-3 w-3 shrink-0" />
                    Em {channelName}
                  </p>
                ) : (
                  <p className="truncate text-[10px] text-muted">
                    {member.statusMessage || "Na selva"}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-y-contain border-l border-border-soft bg-card p-3 sm:flex">
        {renderGroup("👑 DONO DO BANDO", owners, "text-primary")}
        {renderGroup("🐒 MEMBROS", others, "text-muted")}
      </aside>

      {selected && (
        <MemberProfileModal
          member={selected}
          status={statusOf(selected.id)}
          isSelf={selected.id === currentUserId}
          inCallChannel={
            inCall.get(selected.id)
              ? voiceChannelNames[inCall.get(selected.id)!]
              : null
          }
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function MemberProfileModal({
  member,
  status,
  isSelf,
  inCallChannel,
  onClose,
}: {
  member: Member;
  status: PresenceStatus | "offline";
  isSelf: boolean;
  inCallChannel: string | null;
  onClose: () => void;
}) {
  const banner = member.bannerColor ?? colorFromSeed(member.avatarSeed);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-overlay-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-80 animate-modal-in overflow-hidden rounded-2xl border border-border bg-card-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-24 w-full" style={{ backgroundColor: banner }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative -mt-10 px-4 pb-4">
          <div className="relative inline-block">
            <img
              src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(member.avatarSeed)}`}
              alt=""
              className="h-20 w-20 rounded-full border-4 border-card-3 bg-card-2 shadow-xl"
            />
            <span
              className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-card-3 ${
                status === "offline" ? "bg-muted" : STATUS_META[status].dotClass
              }`}
              aria-hidden="true"
            />
          </div>

          <div className="mt-2">
            <div className="flex items-center gap-1.5 text-lg font-black text-accent">
              <span className="truncate">{member.username}</span>
              {member.isOwner && (
                <Crown className="h-4 w-4 shrink-0 text-primary" />
              )}
            </div>
            <div className="text-xs text-muted">
              {status === "offline" ? "Off-line" : STATUS_META[status].label}
            </div>
          </div>

          {member.statusMessage && (
            <div className="mt-3 rounded-xl border border-border bg-card-2 p-2 text-xs text-foreground">
              {member.statusMessage}
            </div>
          )}

          {member.bio && (
            <div className="mt-3 text-xs leading-relaxed text-muted">
              <div className="mb-0.5 text-[10px] font-bold uppercase text-muted">
                Sobre mim
              </div>
              {member.bio}
            </div>
          )}

          {inCallChannel && (
            <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-secondary/30 bg-secondary/10 p-2 text-xs font-semibold text-secondary">
              <Mic className="h-3.5 w-3.5 shrink-0" />
              Em {inCallChannel}
            </div>
          )}

          {!isSelf && (
            <form action={startDm.bind(null, member.id)} className="mt-4">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:brightness-110"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Mensagem
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
