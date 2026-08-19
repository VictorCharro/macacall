"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Hash, Volume2, MicOff, VolumeX } from "lucide-react";
import { ServerHeaderMenu } from "@/components/ServerHeaderMenu";
import { ChannelMenu } from "@/components/ChannelMenu";
import { CreateChannelButton } from "@/components/CreateChannelButton";
import { VoiceConnectedBar } from "@/components/VoiceConnectedBar";
import { UserPanel } from "@/components/UserPanel";
import { useCall } from "@/components/CallProvider";
import { useBandoParticipants } from "@/components/BandoParticipants";

type ChannelInfo = { id: string; name: string };

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
  const participants = useBandoParticipants();

  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-border-soft bg-card">
      <ServerHeaderMenu bandoName={bandoName} inviteUrl={inviteUrl} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-2 py-3">
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
              <Hash className="h-4 w-4 shrink-0 text-muted" />
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
            const isInThisCall = channelParticipants.length > 0;
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
                  <Volume2
                    className={`h-4 w-4 shrink-0 ${isInThisCall ? "text-secondary" : "text-muted"}`}
                  />
                  <span className="truncate">{channel.name}</span>
                </ChannelRow>
                {channelParticipants.length > 0 && (
                  <ul className="ml-6 flex flex-col gap-0.5 py-1">
                    {channelParticipants.map((p) => (
                      <li
                        key={p.identity}
                        className="flex items-center justify-between gap-2 text-xs text-muted"
                      >
                        <span className="truncate">🐵 {p.name}</span>
                        {p.deafened ? (
                          <VolumeX
                            className="h-3.5 w-3.5 shrink-0 text-danger"
                            aria-label="Surdo e mudo"
                          />
                        ) : (
                          p.micMuted && (
                            <MicOff
                              className="h-3.5 w-3.5 shrink-0 text-danger"
                              aria-label="Microfone mudo"
                            />
                          )
                        )}
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
    <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
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
        onDoubleClick={
          isVoice
            ? () => joinCall(bandoId, channel.id, channel.name)
            : undefined
        }
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition ${
          active
            ? "bg-card-2 text-accent"
            : "text-muted hover:bg-card-2/60 hover:text-accent"
        }`}
      >
        {children}
      </Link>
      {isOwner && menuPos && (
        <ChannelMenu
          bandoId={bandoId}
          channelId={channel.id}
          channelName={channel.name}
          x={menuPos.x}
          y={menuPos.y}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  );

  return asListItem ? <li>{row}</li> : row;
}
