"use client";

import { useEffect, useRef, useState } from "react";
import {
  useParticipants,
  useTracks,
  useTrackToggle,
  useTrackMutedIndicator,
  useIsSpeaking,
  VideoTrack,
} from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import type { TrackReference } from "@livekit/components-core";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  Radio,
  Grid,
  Volume2,
} from "lucide-react";
import { useCall } from "@/components/CallProvider";
import { ChatChannel } from "@/components/ChatChannel";
import type { RawReaction } from "@/lib/reactions";

type TextChannelData = {
  id: string;
  name: string;
  topic: string | null;
  initialMessages: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    reply_to_id: string | null;
    pinned: boolean;
  }[];
  initialReactions: RawReaction[];
  members: Record<string, { username: string; avatarSeed: string }>;
  canPin: boolean;
};

export function VoiceChannelView({
  bandoId,
  channelId,
  channelName,
  currentUserId,
  textChannel,
}: {
  bandoId: string;
  channelId: string;
  channelName: string;
  currentUserId: string;
  textChannel: TextChannelData | null;
}) {
  const { activeCall, connected, error, joinCall } = useCall();
  const href = `/bandos/${bandoId}/${channelId}`;

  const isThisChannel = activeCall?.roomId === channelId;

  return (
    <div className="macacall-call flex min-h-0 flex-1 flex-col overflow-hidden">
      {isThisChannel && error && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-card-3/60 px-6 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={() => joinCall(channelId, channelName, href)}
            className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-accent"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {isThisChannel && !connected && !error && (
        <div className="flex shrink-0 items-center gap-3 border-b border-border-soft bg-card-3/60 px-6 py-3">
          <span className="animate-bounce text-xl">🐒</span>
          <p className="text-sm text-muted">
            Balançando de galho em galho até a call...
          </p>
        </div>
      )}

      {!isThisChannel && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-card-3/60 px-6 py-3">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-secondary" />
            <p className="text-sm text-accent">
              Pronto pra entrar em {channelName}
            </p>
          </div>
          <button
            onClick={() => joinCall(channelId, channelName, href)}
            className="rounded-full bg-secondary px-4 py-1.5 text-sm font-semibold text-secondary-foreground transition hover:brightness-95"
          >
            Entrar na call
          </button>
        </div>
      )}

      {isThisChannel && connected && <CallInterface channelName={channelName} />}

      {textChannel ? (
        <ChatChannel
          key={textChannel.id}
          channelId={textChannel.id}
          channelName={textChannel.name}
          channelTopic={textChannel.topic}
          initialMessages={textChannel.initialMessages}
          initialReactions={textChannel.initialReactions}
          members={textChannel.members}
          canPin={textChannel.canPin}
          currentUserId={currentUserId}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted">
          Crie um canal de texto pra conversar por aqui também 🍌
        </div>
      )}
    </div>
  );
}

type StageItem = {
  key: string;
  trackRef?: TrackReference;
  participant: Participant;
};

export function CallInterface({
  channelName,
  compact = false,
  chatHidden = false,
  onToggleChatHidden,
}: {
  channelName: string;
  /** Used when a persistent text chat already exists alongside the call
   * (DMs): docks a shorter, self-scrolling call strip. */
  compact?: boolean;
  /** DM-only: whether the caller has hidden the message thread to give the
   * call more room -- when true this component expands to fill the space. */
  chatHidden?: boolean;
  /** DM-only: show a control-bar button to hide/show the message thread. */
  onToggleChatHidden?: () => void;
}) {
  const { leaveCall, micEnabled, toggleMic } = useCall();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [forceGrid, setForceGrid] = useState(false);
  const participants = useParticipants();
  const videoTracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const videoParticipantKeys = new Set(
    videoTracks.map((t) => `${t.participant.identity}:${t.source}`),
  );
  const voiceOnlyParticipants = participants.filter(
    (p) => !videoParticipantKeys.has(`${p.identity}:${Track.Source.Camera}`),
  );

  const stageItems: StageItem[] = [
    ...videoTracks.map((t) => ({
      key: `${t.participant.identity}:${t.source}`,
      trackRef: t,
      participant: t.participant,
    })),
    ...voiceOnlyParticipants.map((p) => ({
      key: `${p.identity}:avatar`,
      participant: p,
    })),
  ];

  // Clicking any tile pins it, overriding the default; an active screen share
  // is only the *default* spotlight, so people can still click away to look at
  // someone else while it's running. The grid button forces the even grid.
  const screenShareItem = stageItems.find(
    (i) => i.trackRef?.source === Track.Source.ScreenShare,
  );
  const spotlightKey = forceGrid
    ? null
    : focusedKey && stageItems.some((i) => i.key === focusedKey)
      ? focusedKey
      : (screenShareItem?.key ?? null);
  const spotlightItem = stageItems.find((i) => i.key === spotlightKey) ?? null;
  const otherItems = stageItems.filter((i) => i.key !== spotlightKey);

  const cam = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: { audio: true },
  });

  // Mirrors the clone: one tile gets a roomy single column, two split the row,
  // three or four form a 2x2, anything more packs into thirds.
  const gridCols =
    stageItems.length <= 1
      ? "grid-cols-1 mx-auto max-w-2xl"
      : stageItems.length <= 2
        ? "grid-cols-1 md:grid-cols-2"
        : stageItems.length <= 4
          ? "grid-cols-2"
          : "grid-cols-3";

  const stageContent = spotlightItem ? (
    <div className="flex h-full flex-col gap-3">
      <Tile
        trackRef={spotlightItem.trackRef}
        participant={spotlightItem.trackRef ? undefined : spotlightItem.participant}
        size="focus"
        allowFullscreen
      />
      {otherItems.length > 0 && (
        <div className="flex shrink-0 gap-3 overflow-x-auto py-1">
          {otherItems.map((i) => (
            <Tile
              key={i.key}
              trackRef={i.trackRef}
              participant={i.trackRef ? undefined : i.participant}
              size="thumb"
              onFocus={() => setFocusedKey(i.key)}
            />
          ))}
        </div>
      )}
    </div>
  ) : (
    <div className={`grid gap-4 ${gridCols}`}>
      {stageItems.map((i) => (
        <Tile
          key={i.key}
          trackRef={i.trackRef}
          participant={i.trackRef ? undefined : i.participant}
          size="grid"
          onFocus={() => {
            setForceGrid(false);
            setFocusedKey(i.key);
          }}
        />
      ))}
    </div>
  );

  return (
    <div
      className={`flex flex-col border-b border-border-soft bg-stage ${
        compact && !chatHidden ? "" : "min-h-0 flex-1"
      }`}
    >
      <header className="z-20 flex h-12 shrink-0 items-center justify-between border-b border-border-soft bg-card-3/90 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-xs font-bold text-secondary">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>AO VIVO</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-accent">
            <span className="truncate">🌴 {channelName}</span>
            <span className="shrink-0 text-xs font-normal text-muted">
              ({participants.length}{" "}
              {participants.length === 1 ? "macaco conectado" : "macacos conectados"})
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setForceGrid((v) => !v);
            setFocusedKey(null);
          }}
          title={forceGrid ? "Voltar ao palco" : "Ver em grade"}
          aria-label={forceGrid ? "Voltar ao palco" : "Ver em grade"}
          className={`shrink-0 rounded-lg p-1.5 transition ${
            forceGrid
              ? "bg-secondary/20 text-secondary"
              : "bg-card-2 text-muted hover:text-accent"
          }`}
        >
          <Grid className="h-4 w-4" />
        </button>
      </header>

      <div
        className={`min-h-0 overflow-y-auto p-4 ${
          compact && !chatHidden ? "max-h-[45vh]" : "flex-1"
        }`}
      >
        {stageContent}
      </div>

      <div className="flex h-20 shrink-0 items-center justify-center gap-3 border-t border-border-soft bg-card-3 px-6">
        <CallButton
          onClick={toggleMic}
          title={micEnabled ? "Silenciar" : "Ativar microfone"}
          tone={micEnabled ? "neutral" : "danger"}
        >
          {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </CallButton>

        <CallButton
          onClick={() => cam.toggle()}
          title={cam.enabled ? "Desligar câmera" : "Ligar câmera"}
          tone={cam.enabled ? "secondary" : "neutral"}
        >
          {cam.enabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </CallButton>

        <CallButton
          onClick={() => screen.toggle()}
          title={screen.enabled ? "Parar compartilhamento" : "Compartilhar tela"}
          tone={screen.enabled ? "primary" : "neutral"}
        >
          {screen.enabled ? (
            <MonitorOff className="h-5 w-5" />
          ) : (
            <Monitor className="h-5 w-5" />
          )}
        </CallButton>

        {onToggleChatHidden && (
          <CallButton
            onClick={onToggleChatHidden}
            title={chatHidden ? "Mostrar chat" : "Minimizar chat"}
            tone={chatHidden ? "neutral" : "secondary"}
          >
            {chatHidden ? (
              <Maximize2 className="h-5 w-5" />
            ) : (
              <Minimize2 className="h-5 w-5" />
            )}
          </CallButton>
        )}

        <button
          onClick={leaveCall}
          title="Sair da call"
          aria-label="Sair da call"
          className="ml-3 flex h-12 w-14 items-center justify-center rounded-full bg-danger text-white shadow-lg shadow-danger/30 transition active:scale-95 hover:brightness-90"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function CallButton({
  onClick,
  title,
  tone,
  children,
}: {
  onClick: () => void;
  title: string;
  tone: "neutral" | "secondary" | "primary" | "danger";
  children: React.ReactNode;
}) {
  const toneClasses = {
    neutral: "bg-card-2 text-foreground hover:brightness-125",
    secondary: "bg-secondary text-secondary-foreground hover:brightness-110",
    primary:
      "bg-primary text-primary-foreground shadow-primary/30 ring-2 ring-primary/40 hover:brightness-105",
    danger: "bg-danger text-white hover:brightness-90",
  } as const;

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-12 w-12 items-center justify-center rounded-full font-bold shadow-lg transition active:scale-95 ${toneClasses[tone]}`}
    >
      {children}
    </button>
  );
}

const TILE_SIZE = {
  /** Large spotlight tile: fills the row, capped so it never eats the page. */
  focus: "w-full flex-1 min-h-0",
  /** Small tile in the strip alongside a spotlight. */
  thumb: "w-36 shrink-0 aspect-video",
  /** Even grid: sized by the CSS grid itself. */
  grid: "w-full aspect-video",
} as const;

/**
 * One participant tile: their video if they have a camera/screen-share track,
 * otherwise a centred avatar. Both get the same corner name badge, so the name
 * is never rendered twice.
 */
function Tile({
  trackRef,
  participant: standaloneParticipant,
  size,
  onFocus,
  allowFullscreen,
}: {
  trackRef?: TrackReference;
  participant?: Participant;
  size: keyof typeof TILE_SIZE;
  /** Present when clicking this tile should send it to the spotlight. */
  onFocus?: () => void;
  allowFullscreen?: boolean;
}) {
  const participant = trackRef?.participant ?? standaloneParticipant!;
  const isScreenShare = trackRef?.source === Track.Source.ScreenShare;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isMuted } = useTrackMutedIndicator({
    participant,
    source: Track.Source.Microphone,
  });
  const isSpeaking = useIsSpeaking(participant);

  useEffect(() => {
    if (!allowFullscreen) return;
    function onChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [allowFullscreen]);

  function toggleFullscreen(e: React.MouseEvent) {
    e.stopPropagation();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }

  const name = participant.name || participant.identity;

  return (
    <div
      ref={containerRef}
      onClick={onFocus}
      className={`group relative overflow-hidden rounded-2xl border-2 bg-card-2 shadow-xl transition ${TILE_SIZE[size]} ${
        isSpeaking
          ? "border-secondary shadow-secondary/20 ring-4 ring-secondary/25"
          : isScreenShare
            ? "border-primary/40"
            : "border-border"
      } ${onFocus ? "cursor-pointer hover:border-secondary/60" : ""} ${
        isFullscreen ? "!aspect-auto !h-screen !w-screen !max-h-none" : ""
      }`}
    >
      {trackRef ? (
        <VideoTrack
          trackRef={trackRef}
          className={`h-full w-full ${
            size === "focus" ? "bg-black object-contain" : "object-cover"
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-card-2 p-4">
          <div className="relative">
            <div
              className={`flex items-center justify-center rounded-full border-4 bg-background transition-transform duration-200 ${
                size === "thumb" ? "h-12 w-12 text-xl" : "h-24 w-24 text-4xl"
              } ${
                isSpeaking
                  ? "scale-105 border-secondary shadow-xl shadow-secondary/40"
                  : "border-border"
              }`}
            >
              🐵
            </div>
            {isSpeaking && (
              <span className="pointer-events-none absolute inset-0 animate-ping rounded-full border-2 border-secondary opacity-60" />
            )}
          </div>
        </div>
      )}

      <span className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
        {isScreenShare && <Monitor className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="truncate">
          {isScreenShare ? `Tela de ${name}` : name}
        </span>
        {!isScreenShare &&
          (isMuted ? (
            <MicOff className="h-3.5 w-3.5 shrink-0 text-danger" />
          ) : (
            <Mic className="h-3.5 w-3.5 shrink-0 text-secondary" />
          ))}
      </span>

      {allowFullscreen && (
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}
