"use client";

import { useMemo, useState } from "react";
import { Crown, Mic, X, MessageSquare, ShieldOff, LogOut } from "lucide-react";
import { useBandoParticipants } from "@/components/BandoParticipants";
import { useMembersPanel } from "@/components/MembersPanelProvider";
import { usePresence } from "@/components/PresenceProvider";
import { STATUS_META } from "@/lib/presence";
import { colorFromSeed } from "@/lib/colorFromSeed";
import { avatarUrl } from "@/lib/avatar";
import { startDm } from "@/app/actions/dms";
import {
  assignRole,
  removeRole,
  kickMember,
  banMember,
} from "@/app/actions/roles";
import { hasPermission } from "@/lib/permissions";
import type { PresenceStatus, Role } from "@/lib/types";

type Member = {
  id: string;
  username: string;
  avatarSeed: string;
  avatarUrl: string | null;
  isOwner: boolean;
  statusMessage: string | null;
  bio: string | null;
  bannerColor: string | null;
  roleColor: string | null;
  roleIds: string[];
  hoistedRoleName: string | null;
  highestRolePosition: number;
};

export function MembersSidebar({
  bandoId,
  members,
  roles,
  voiceChannelNames,
  currentUserId,
  isOwner,
  myPermissions,
  myHighestPosition,
}: {
  bandoId: string;
  members: Member[];
  roles: Role[];
  voiceChannelNames: Record<string, string>;
  currentUserId: string;
  isOwner: boolean;
  myPermissions: number;
  myHighestPosition: number;
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

  const statusOf = (id: string): PresenceStatus | "offline" => {
    const status = online.get(id);
    if (!status || status === "invisible") return "offline";
    return status;
  };

  const owners = members.filter((m) => m.isOwner);
  const rest = members.filter((m) => !m.isOwner);

  const hoistedRoles = roles
    .filter((r) => r.hoist && !r.is_default)
    .sort((a, b) => b.position - a.position);

  const grouped: { title: string; colorClass: string; list: Member[] }[] = [
    { title: "👑 DONO DO BANDO", colorClass: "text-primary", list: owners },
  ];
  const consumed = new Set(owners.map((m) => m.id));
  for (const role of hoistedRoles) {
    const list = rest.filter(
      (m) => !consumed.has(m.id) && m.roleIds.includes(role.id),
    );
    list.forEach((m) => consumed.add(m.id));
    if (list.length) {
      grouped.push({
        title: `${role.name.toUpperCase()}`,
        colorClass: "",
        list,
      });
    }
  }
  grouped.push({
    title: "🐒 MEMBROS",
    colorClass: "text-muted",
    list: rest.filter((m) => !consumed.has(m.id)),
  });

  const renderGroup = (title: string, colorClass: string, list: Member[]) => {
    if (list.length === 0) return null;
    return (
      <div key={title} className="space-y-1">
        <div
          className={`px-2 py-1 text-[11px] font-bold tracking-wider ${colorClass || "text-muted"}`}
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
                  src={avatarUrl(member.avatarSeed, member.avatarUrl)}
                  alt=""
                  className="h-8 w-8 rounded-full border border-border bg-card-3 object-cover"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                    status === "offline" ? "bg-muted" : STATUS_META[status].dotClass
                  }`}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <p
                  className="flex items-center gap-1 truncate text-xs font-bold group-hover:text-accent"
                  style={{ color: member.roleColor ?? undefined }}
                >
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
      <aside className="scroll-hover hidden w-60 shrink-0 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-y-contain border-l border-border-soft bg-card p-3 sm:flex">
        {grouped.map((g) => renderGroup(g.title, g.colorClass, g.list))}
      </aside>

      {selected && (
        <MemberProfileModal
          bandoId={bandoId}
          member={selected}
          status={statusOf(selected.id)}
          isSelf={selected.id === currentUserId}
          inCallChannel={
            inCall.get(selected.id)
              ? voiceChannelNames[inCall.get(selected.id)!]
              : null
          }
          roles={roles}
          canManageRoles={
            isOwner ||
            (hasPermission(myPermissions, "MANAGE_ROLES") &&
              selected.highestRolePosition < myHighestPosition)
          }
          canKick={
            !selected.isOwner &&
            (isOwner ||
              (hasPermission(myPermissions, "KICK_MEMBERS") &&
                selected.highestRolePosition < myHighestPosition))
          }
          canBan={
            !selected.isOwner &&
            (isOwner ||
              (hasPermission(myPermissions, "BAN_MEMBERS") &&
                selected.highestRolePosition < myHighestPosition))
          }
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function MemberProfileModal({
  bandoId,
  member,
  status,
  isSelf,
  inCallChannel,
  roles,
  canManageRoles,
  canKick,
  canBan,
  onClose,
}: {
  bandoId: string;
  member: Member;
  status: PresenceStatus | "offline";
  isSelf: boolean;
  inCallChannel: string | null;
  roles: Role[];
  canManageRoles: boolean;
  canKick: boolean;
  canBan: boolean;
  onClose: () => void;
}) {
  const banner = member.bannerColor ?? colorFromSeed(member.avatarSeed);
  const [roleIds, setRoleIds] = useState(member.roleIds);
  const [pending, setPending] = useState<string | null>(null);
  const assignableRoles = roles.filter((r) => !r.is_default);

  async function toggleRole(role: Role) {
    setPending(role.id);
    const has = roleIds.includes(role.id);
    if (has) {
      setRoleIds((prev) => prev.filter((id) => id !== role.id));
      await removeRole(bandoId, member.id, role.id);
    } else {
      setRoleIds((prev) => [...prev, role.id]);
      await assignRole(bandoId, member.id, role.id);
    }
    setPending(null);
  }

  async function handleKick() {
    if (!confirm(`Expulsar ${member.username} do bando?`)) return;
    await kickMember(bandoId, member.id);
    onClose();
  }

  async function handleBan() {
    const reason = prompt(`Banir ${member.username}? Motivo (opcional):`);
    if (reason === null) return;
    await banMember(bandoId, member.id, reason || null);
    onClose();
  }

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

        <div className="relative -mt-10 max-h-[70vh] overflow-y-auto scroll-hover px-4 pb-4">
          <div className="relative inline-block">
            <img
              src={avatarUrl(member.avatarSeed, member.avatarUrl)}
              alt=""
              className="h-20 w-20 rounded-full border-4 border-card-3 bg-card-2 object-cover shadow-xl"
            />
            <span
              className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-card-3 ${
                status === "offline" ? "bg-muted" : STATUS_META[status].dotClass
              }`}
              aria-hidden="true"
            />
          </div>

          <div className="mt-2">
            <div
              className="flex items-center gap-1.5 text-lg font-black text-accent"
              style={{ color: member.roleColor ?? undefined }}
            >
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

          {canManageRoles && assignableRoles.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[10px] font-bold uppercase text-muted">
                Cargos
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assignableRoles.map((role) => {
                  const active = roleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      disabled={pending === role.id}
                      onClick={() => toggleRole(role)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                        active
                          ? "border-transparent text-white"
                          : "border-border-soft text-muted hover:text-foreground"
                      }`}
                      style={active ? { backgroundColor: role.color } : undefined}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: active ? "rgba(255,255,255,0.7)" : role.color,
                        }}
                        aria-hidden="true"
                      />
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isSelf && (
            <div className="mt-4 space-y-2">
              <form action={startDm.bind(null, member.id)}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:brightness-110"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Mensagem
                </button>
              </form>

              {(canKick || canBan) && (
                <div className="flex gap-2">
                  {canKick && (
                    <button
                      type="button"
                      onClick={handleKick}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-danger/40 py-2 text-xs font-bold text-danger transition hover:bg-danger/10"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Expulsar
                    </button>
                  )}
                  {canBan && (
                    <button
                      type="button"
                      onClick={handleBan}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger py-2 text-xs font-bold text-white transition hover:brightness-110"
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                      Banir
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
