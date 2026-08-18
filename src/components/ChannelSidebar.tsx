"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ServerHeaderMenu } from "@/components/ServerHeaderMenu";
import { ChannelMenu } from "@/components/ChannelMenu";
import { CreateChannelButton } from "@/components/CreateChannelButton";
import { VoiceConnectedBar } from "@/components/VoiceConnectedBar";
import { UserPanel } from "@/components/UserPanel";
import { useCall } from "@/components/CallProvider";

type ChannelInfo = { id: string; name: string };
type Participant = { identity: string; name: string; channelId: string };

export function ChannelSidebar({
  bandoId,
  bandoName,
  inviteUrl,
  isOwner,
  textChannels,
  voiceChannels,
  selfUsername,
  selfAvatarSeed,
}: {
  bandoId: string;
  bandoName: string;
  inviteUrl: string;
  isOwner: boolean;
  textChannels: ChannelInfo[];
  voiceChannels: ChannelInfo[];
  selfUsername: string;
  selfAvatarSeed: string;
}) {
  const pathname = usePathname();
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/livekit/participants?bandoId=${bandoId}`);
        const data = await res.json();
        if (!cancelled) setParticipants(data.participants ?? []);
      } catch {
        // silencioso
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
    <nav className="flex w-72 shrink-0 flex-col border-r border-border bg-card/40">
      <ServerHeaderMenu bandoName={bandoName} inviteUrl={inviteUrl} />

      <div className="flex flex-1 flex-col gap-4 px-2 py-3">
        <ChannelGroup label="Canais de Texto">
          {isOwner && <CreateChannelButton bandoId={bandoId} type="text" />}
        </ChannelGroup>
        <ul className="flex flex-col gap-0.5">
          {textChannels.map((channel) => (
            <ChannelRow
              key={channel.id}
              bandoId={bandoId}
              channel={channel}
              isOwner={isOwner}
              active={pathname === `/bandos/${bandoId}/${channel.id}`}
            >
              <span className="text-muted">#</span>
              <span className="truncate">{channel.name}</span>
            </ChannelRow>
          ))}
        </ul>

        <ChannelGroup label="Canais de Voz">
          {isOwner && <CreateChannelButton bandoId={bandoId} type="voice" />}
        </ChannelGroup>
        <ul className="flex flex-col gap-0.5">
          {voiceChannels.map((channel) => {
            const channelParticipants = participants.filter(
              (p) => p.channelId === channel.id,
            );
            return (
              <li key={channel.id} className="flex flex-col">
                <ChannelRow
                  bandoId={bandoId}
                  channel={channel}
                  isOwner={isOwner}
                  active={pathname === `/bandos/${bandoId}/${channel.id}`}
                  asListItem={false}
                  isVoice
                >
                  <span className="text-muted">🔊</span>
                  <span className="truncate">{channel.name}</span>
                </ChannelRow>
                {channelParticipants.length > 0 && (
                  <ul className="ml-6 flex flex-col gap-0.5 py-1">
                    {channelParticipants.map((p) => (
                      <li
                        key={p.identity}
                        className="truncate text-xs text-muted"
                      >
                        🐵 {p.name}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <VoiceConnectedBar />
      <UserPanel username={selfUsername} avatarSeed={selfAvatarSeed} />
    </nav>
  );
}

function ChannelGroup({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-muted">
      <span>{label}</span>
      {children}
    </div>
  );
}

function ChannelRow({
  bandoId,
  channel,
  isOwner,
  active,
  asListItem = true,
  isVoice = false,
  children,
}: {
  bandoId: string;
  channel: ChannelInfo;
  isOwner: boolean;
  active: boolean;
  asListItem?: boolean;
  isVoice?: boolean;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { joinCall } = useCall();

  const row = (
    <div
      className="group relative"
      onContextMenu={
        isOwner
          ? (e) => {
              e.preventDefault();
              setMenuOpen(true);
            }
          : undefined
      }
    >
      <Link
        href={`/bandos/${bandoId}/${channel.id}`}
        onDoubleClick={
          isVoice
            ? () => joinCall(bandoId, channel.id, channel.name)
            : undefined
        }
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
          active
            ? "bg-border/60 text-accent"
            : "text-muted hover:bg-border/30 hover:text-accent"
        }`}
      >
        {children}
      </Link>
      {isOwner && menuOpen && (
        <ChannelMenu
          bandoId={bandoId}
          channelId={channel.id}
          channelName={channel.name}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );

  return asListItem ? <li>{row}</li> : row;
}
