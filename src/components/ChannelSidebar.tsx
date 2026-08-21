"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Hash,
  Volume2,
  MicOff,
  HeadphoneOff,
  ChevronDown,
  ArrowRightLeft,
} from "lucide-react";
import { ServerHeaderMenu } from "@/components/ServerHeaderMenu";
import { ChannelMenu } from "@/components/ChannelMenu";
import { CreateChannelButton } from "@/components/CreateChannelButton";
import { VoiceConnectedBar } from "@/components/VoiceConnectedBar";
import { UserPanel } from "@/components/UserPanel";
import { useCall } from "@/components/CallProvider";
import {
  useBandoParticipants,
  useRefreshBandoParticipants,
} from "@/components/BandoParticipants";
import type { BandoParticipant } from "@/components/BandoParticipants";
import { ContextMenuPortal } from "@/components/ContextMenuPortal";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@/lib/types";

type ChannelInfo = {
  id: string;
  name: string;
  category: string | null;
  topic: string | null;
  unread: number;
};

/**
 * Channels are grouped by their category, falling back to a default heading
 * per type so a bando that never set categories still reads like Discord.
 */
function groupByCategory(channels: ChannelInfo[], fallback: string) {
  const groups = new Map<string, ChannelInfo[]>();
  for (const channel of channels) {
    const key = channel.category?.trim() || fallback;
    const existing = groups.get(key);
    if (existing) existing.push(channel);
    else groups.set(key, [channel]);
  }
  return [...groups];
}

export function ChannelSidebar({
  bandoId,
  bandoName,
  inviteUrl,
  isOwner,
  myPermissions,
  roles,
  textChannels,
  voiceChannels,
  selfUsername,
  selfAvatarSeed,
  selfUserId,
}: {
  bandoId: string;
  bandoName: string;
  inviteUrl: string;
  isOwner: boolean;
  myPermissions: number;
  roles: Role[];
  textChannels: ChannelInfo[];
  voiceChannels: ChannelInfo[];
  selfUsername: string;
  selfAvatarSeed: string;
  selfUserId: string;
}) {
  const pathname = usePathname();
  const participants = useBandoParticipants();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const canManageChannels =
    isOwner || hasPermission(myPermissions, "MANAGE_CHANNELS");
  const canManageRoles = isOwner || hasPermission(myPermissions, "MANAGE_ROLES");
  const canViewSettings =
    isOwner ||
    hasPermission(myPermissions, "MANAGE_BANDO") ||
    hasPermission(myPermissions, "KICK_MEMBERS") ||
    hasPermission(myPermissions, "BAN_MEMBERS");
  const canModerate =
    isOwner ||
    hasPermission(myPermissions, "MUTE_MEMBERS") ||
    hasPermission(myPermissions, "MOVE_MEMBERS") ||
    hasPermission(myPermissions, "DEAFEN_MEMBERS");

  function toggleCategory(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const textGroups = groupByCategory(textChannels, "Canais de Texto");
  const voiceGroups = groupByCategory(voiceChannels, "Canais de Voz");

  return (
    <nav className="z-10 flex w-60 shrink-0 flex-col border-r border-border-soft bg-card">
      <ServerHeaderMenu
        bandoId={bandoId}
        bandoName={bandoName}
        inviteUrl={inviteUrl}
        roles={roles}
        canManageRoles={canManageRoles}
        canViewSettings={canViewSettings}
      />

      <div className="scroll-hover flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 py-3">
        {textGroups.map(([category, channels]) => (
          <div key={`text-${category}`} className="space-y-0.5">
            <CategoryHeader
              label={category}
              collapsed={collapsed.has(`text-${category}`)}
              onToggle={() => toggleCategory(`text-${category}`)}
            >
              {canManageChannels && (
                <CreateChannelButton bandoId={bandoId} type="text" />
              )}
            </CategoryHeader>

            {!collapsed.has(`text-${category}`) && (
              <ul className="flex flex-col gap-0.5 pt-1">
                {channels.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    bandoId={bandoId}
                    channel={channel}
                    isOwner={canManageChannels}
                    roles={roles}
                    active={pathname === `/bandos/${bandoId}/${channel.id}`}
                  >
                    <Hash className="h-4 w-4 shrink-0 text-muted" />
                    <span className="truncate">{channel.name}</span>
                  </ChannelRow>
                ))}
              </ul>
            )}
          </div>
        ))}

        {voiceGroups.map(([category, channels]) => (
          <div key={`voice-${category}`} className="space-y-0.5">
            <CategoryHeader
              label={category}
              collapsed={collapsed.has(`voice-${category}`)}
              onToggle={() => toggleCategory(`voice-${category}`)}
            >
              {canManageChannels && (
                <CreateChannelButton bandoId={bandoId} type="voice" />
              )}
            </CategoryHeader>

            {!collapsed.has(`voice-${category}`) && (
              <ul className="flex flex-col gap-0.5 pt-1">
                {channels.map((channel) => {
                  const channelParticipants = participants.filter(
                    (p) => p.channelId === channel.id,
                  );
                  const isInThisCall = channelParticipants.length > 0;

                  return (
                    <li key={channel.id} className="flex flex-col">
                      <ChannelRow
                        bandoId={bandoId}
                        channel={channel}
                        isOwner={canManageChannels}
                        roles={roles}
                        active={pathname === `/bandos/${bandoId}/${channel.id}`}
                        live={isInThisCall}
                        asListItem={false}
                        isVoice
                      >
                        <Volume2
                          className={`h-4 w-4 shrink-0 ${
                            isInThisCall
                              ? "animate-pulse text-secondary"
                              : "text-muted"
                          }`}
                        />
                        <span className="truncate">{channel.name}</span>
                      </ChannelRow>

                      {channelParticipants.length > 0 && (
                        <ul className="space-y-1 py-1 pl-6">
                          {channelParticipants.map((p) => (
                            <VoiceParticipantRow
                              key={p.identity}
                              participant={p}
                              channelId={channel.id}
                              voiceChannels={voiceChannels}
                              canModerate={canModerate}
                              isSelf={p.identity === selfUserId}
                            />
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      <VoiceConnectedBar />
      <UserPanel username={selfUsername} avatarSeed={selfAvatarSeed} />
    </nav>
  );
}

function CategoryHeader({
  label,
  collapsed,
  onToggle,
  children,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 items-center gap-1 transition hover:text-accent"
      >
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform ${
            collapsed ? "-rotate-90" : ""
          }`}
        />
        <span className="truncate">{label}</span>
      </button>
      {children}
    </div>
  );
}

function ChannelRow({
  bandoId,
  channel,
  isOwner,
  roles,
  active,
  live = false,
  asListItem = true,
  isVoice = false,
  children,
}: {
  bandoId: string;
  channel: ChannelInfo;
  isOwner: boolean;
  roles: Role[];
  active: boolean;
  live?: boolean;
  asListItem?: boolean;
  isVoice?: boolean;
  children: React.ReactNode;
}) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const { joinCall } = useCall();

  const row = (
    <div
      className="group relative"
      onContextMenu={
        isOwner
          ? (e) => {
              e.preventDefault();
              setMenuPos({ x: e.clientX, y: e.clientY });
            }
          : undefined
      }
    >
      <Link
        href={`/bandos/${bandoId}/${channel.id}`}
        // Discord joins a voice channel on a single click -- the navigation
        // and the connection happen together, there's no "preview it first"
        // step. (This used to be onDoubleClick *and* passed the wrong
        // arguments, so it joined a room keyed by bandoId instead of the
        // channel.)
        onClick={
          isVoice
            ? () =>
                joinCall(
                  channel.id,
                  channel.name,
                  `/bandos/${bandoId}/${channel.id}`,
                )
            : undefined
        }
        className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs font-medium transition ${
          active
            ? "bg-card-2 font-semibold text-accent"
            : live
              ? "border border-secondary/30 bg-secondary/10 font-semibold text-secondary"
              : "text-muted hover:bg-card-2/60 hover:text-foreground"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">{children}</div>

        {channel.unread > 0 && !active && (
          <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground">
            {channel.unread > 99 ? "99+" : channel.unread}
          </span>
        )}
      </Link>

      {isOwner && menuPos && (
        <ChannelMenu
          bandoId={bandoId}
          channelId={channel.id}
          channelName={channel.name}
          channelTopic={channel.topic}
          roles={roles}
          x={menuPos.x}
          y={menuPos.y}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  );

  return asListItem ? <li>{row}</li> : row;
}

function VoiceParticipantRow({
  participant,
  channelId,
  voiceChannels,
  canModerate,
  isSelf,
}: {
  participant: BandoParticipant;
  channelId: string;
  voiceChannels: ChannelInfo[];
  canModerate: boolean;
  isSelf: boolean;
}) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  // The poll behind `participant` only refreshes every 4s and depends on the
  // LiveKit server having already observed a published/unpublished track —
  // for our OWN row we already know the real state instantly from the call
  // context, so use that instead of waiting on the poll to catch up.
  const self = useCall();
  const deafened = isSelf ? self.deafened : participant.deafened;
  const forceMuted = isSelf ? self.forceMuted : participant.forceMuted;
  const micMuted = isSelf ? !self.micEnabled : participant.micMuted;

  return (
    <li
      className="flex items-center justify-between gap-2 py-0.5 text-xs text-muted"
      onContextMenu={
        canModerate
          ? (e) => {
              e.preventDefault();
              setMenuPos({ x: e.clientX, y: e.clientY });
            }
          : undefined
      }
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card-3 text-[10px] ring-1 ring-secondary/40"
          aria-hidden="true"
        >
          🐵
        </span>
        <span className="truncate">{participant.name}</span>
      </span>

      <span className="flex shrink-0 items-center gap-1">
        {(() => {
          // Only a moderator's forceMuted turns this red — self-mute and
          // self-deafen are both just the user's own choice, always gray.
          const color = forceMuted ? "text-danger" : "text-muted";
          const label = forceMuted ? "Mutado por um moderador" : "Microfone mudo";
          if (deafened) {
            // Deafening also mutes the mic, and both badges show together —
            // matches Discord's own voice-channel member list.
            return (
              <>
                <MicOff className={`h-3.5 w-3.5 ${color}`} aria-label={label} />
                <HeadphoneOff className={`h-3.5 w-3.5 ${color}`} aria-label="Surdo" />
              </>
            );
          }
          return (
            micMuted && (
              <MicOff className={`h-3.5 w-3.5 ${color}`} aria-label={label} />
            )
          );
        })()}
      </span>

      {menuPos && (
        <VoiceParticipantMenu
          participant={participant}
          channelId={channelId}
          voiceChannels={voiceChannels}
          x={menuPos.x}
          y={menuPos.y}
          onClose={() => setMenuPos(null)}
        />
      )}
    </li>
  );
}

function VoiceParticipantMenu({
  participant,
  channelId,
  voiceChannels,
  x,
  y,
  onClose,
}: {
  participant: BandoParticipant;
  channelId: string;
  voiceChannels: ChannelInfo[];
  x: number;
  y: number;
  onClose: () => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const otherChannels = voiceChannels.filter((c) => c.id !== channelId);
  const refreshParticipants = useRefreshBandoParticipants();

  async function moderate(
    action: "mute" | "unmute" | "deafen" | "undeafen" | "move",
    destinationChannelId?: string,
  ) {
    onClose();
    try {
      const res = await fetch("/api/livekit/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          channelId,
          targetUserId: participant.identity,
          destinationChannelId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Falha na moderação:", data.error ?? res.statusText);
        return;
      }
      // Don't wait up to 4s for the shared poll to notice — the icon should
      // flip as soon as the moderator sees the menu close.
      refreshParticipants();
    } catch (err) {
      console.error("Falha na moderação:", err);
    }
  }

  return (
    <ContextMenuPortal x={x} y={y} onClose={onClose}>
      {moveOpen ? (
        <div className="flex flex-col gap-1">
          {otherChannels.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">
              Nenhum outro canal de voz nesse bando.
            </p>
          ) : (
            otherChannels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => moderate("move", c.id)}
                className="rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2"
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {participant.forceMuted ? (
            <button
              type="button"
              onClick={() => moderate("unmute")}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2"
            >
              <MicOff className="h-4 w-4" />
              Desmutar membro
            </button>
          ) : (
            <button
              type="button"
              onClick={() => moderate("mute")}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2"
            >
              <MicOff className="h-4 w-4" />
              Silenciar membro
            </button>
          )}
          {participant.forceDeafened ? (
            <button
              type="button"
              onClick={() => moderate("undeafen")}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2"
            >
              <HeadphoneOff className="h-4 w-4" />
              Remover ensurdecimento
            </button>
          ) : (
            <button
              type="button"
              onClick={() => moderate("deafen")}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2"
            >
              <HeadphoneOff className="h-4 w-4" />
              Ensurdecer membro
            </button>
          )}
          <button
            type="button"
            onClick={() => setMoveOpen(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Mover para...
          </button>
        </div>
      )}
    </ContextMenuPortal>
  );
}
