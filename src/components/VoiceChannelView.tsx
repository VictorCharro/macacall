"use client";

import { useEffect, useRef, useState } from "react";
import {
  useParticipants,
  useTracks,
  useTrackToggle,
  useTrackMutedIndicator,
  useIsSpeaking,
  VideoTrack,
  Chat,
} from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import type { TrackReference } from "@livekit/components-core";
import { useCall } from "@/components/CallProvider";

export function VoiceChannelView({
  bandoId,
  channelId,
  channelName,
}: {
  bandoId: string;
  channelId: string;
  channelName: string;
}) {
  const { activeCall, connected, error, joinCall } = useCall();
  const href = `/bandos/${bandoId}/${channelId}`;

  const isThisChannel = activeCall?.roomId === channelId;

  if (isThisChannel && error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-danger">{error}</p>
        <button
          onClick={() => joinCall(channelId, channelName, href)}
          className="rounded-full border border-border px-4 py-2 font-semibold text-accent"
        >
          Tentar de novo
        </button>
      </main>
    );
  }

  if (isThisChannel && !connected) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3">
        <span className="animate-bounce text-4xl">🐒</span>
        <p className="text-muted">Balançando de galho em galho até a call...</p>
      </main>
    );
  }

  if (!isThisChannel) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="text-4xl">🌴</span>
        <p className="text-accent">Pronto pra entrar em {channelName}</p>
        <button
          onClick={() => joinCall(channelId, channelName, href)}
          className="rounded-full bg-secondary px-6 py-3 font-semibold text-secondary-foreground transition hover:brightness-95"
        >
          Entrar na call
        </button>
      </main>
    );
  }

  return (
    <div className="macacall-call flex min-h-0 flex-1 flex-col overflow-hidden">
      <CallInterface channelName={channelName} />
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
   * (DMs): docks a shorter, self-scrolling call strip with no header/
   * in-call chat, since that would just duplicate the DM's own thread. */
  compact?: boolean;
  /** DM-only: whether the caller has hidden the message thread to give the
   * call more room -- when true this component expands to fill the space. */
  chatHidden?: boolean;
  /** DM-only: show a control-bar button to hide/show the message thread. */
  onToggleChatHidden?: () => void;
}) {
  const { leaveCall, micEnabled, toggleMic } = useCall();
  const [chatOpen, setChatOpen] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
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
    ...voiceOnlyParticipants.map((p) => ({ key: `${p.identity}:avatar`, participant: p })),
  ];

  // Clicking any tile pins it, overriding the default; an active screen
  // share is only the *default* spotlight, so people can still click away
  // to look at someone else while it's running. Once the pinned item
  // disappears (they hang up / stop sharing) it falls back to the share,
  // then to nothing at all -- the plain even grid, same as Discord's
  // default view.
  const screenShareItem = stageItems.find((i) => i.trackRef?.source === Track.Source.ScreenShare);
  const spotlightKey =
    focusedKey && stageItems.some((i) => i.key === focusedKey)
      ? focusedKey
      : (screenShareItem?.key ?? null);
  const spotlightItem = stageItems.find((i) => i.key === spotlightKey) ?? null;
  const otherItems = stageItems.filter((i) => i.key !== spotlightKey);

  const cam = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({ source: Track.Source.ScreenShare });

  const stageContent = spotlightItem ? (
    <div className="flex h-full flex-col gap-2">
      <Tile
        trackRef={spotlightItem.trackRef}
        participant={spotlightItem.trackRef ? undefined : spotlightItem.participant}
        size="focus"
        allowFullscreen
      />
      {otherItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {stageItems.map((i) => (
        <Tile
          key={i.key}
          trackRef={i.trackRef}
          participant={i.trackRef ? undefined : i.participant}
          size="grid"
          onFocus={() => setFocusedKey(i.key)}
        />
      ))}
    </div>
  );

  return (
    <div
      className={
        compact
          ? `flex flex-col bg-card/60 ${chatHidden ? "min-h-0 flex-1" : "border-b border-border"}`
          : "flex min-h-0 flex-1 flex-col"
      }
    >
      {!compact && (
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <h1 className="font-semibold text-accent">
            🌴 {channelName} · {participants.length}{" "}
            {participants.length === 1 ? "macaco" : "macacos"}
          </h1>
        </header>
      )}

      <div className={compact ? "flex min-h-0 flex-1" : "flex min-h-0 flex-1"}>
        <div
          className={
            compact
              ? `${chatHidden ? "min-h-0 flex-1" : "max-h-[45vh] flex-1"} overflow-y-auto p-3`
              : "min-h-0 flex-1 overflow-y-auto p-4"
          }
        >
          {stageContent}
        </div>

        {!compact && chatOpen && (
          <div className="w-72 flex-shrink-0 border-l border-border bg-card">
            <Chat style={{ height: "100%" }} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-border bg-card px-4 py-2.5">
        <ControlButton
          active={micEnabled}
          onClick={toggleMic}
          label={micEnabled ? "Mic ligado" : "Mic mudo"}
          icon={micEnabled ? "🎙️" : "🔇"}
        />
        <ControlButton
          active={cam.enabled}
          onClick={() => cam.toggle()}
          label={cam.enabled ? "Câmera ligada" : "Ligar câmera"}
          icon="📷"
        />
        <ControlButton
          active={screen.enabled}
          onClick={() => screen.toggle()}
          label={screen.enabled ? "Parar tela" : "Compartilhar tela"}
          icon="🖥️"
        />
        {!compact && (
          <ControlButton
            active={chatOpen}
            onClick={() => setChatOpen((v) => !v)}
            label="Chat"
            icon="💬"
          />
        )}
        {onToggleChatHidden && (
          <ControlButton
            active={!chatHidden}
            onClick={onToggleChatHidden}
            label={chatHidden ? "Mostrar chat" : "Minimizar chat"}
            icon="💬"
          />
        )}
        <button
          onClick={leaveCall}
          className="ml-2 rounded-full bg-danger px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-90"
        >
          Sair 🍌
        </button>
      </div>
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "border-secondary bg-secondary/15 text-secondary"
          : "border-border bg-background text-muted hover:border-secondary/50"
      }`}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

const TILE_WIDTH = {
  // large spotlight tile: fills the row, capped so it never dominates the
  // whole call area even on wide screens
  focus: "w-full max-h-[42vh]",
  // small tile alongside a spotlight
  thumb: "w-32 sm:w-40",
  // even grid: sized by the CSS grid itself
  grid: "w-full",
} as const;

/**
 * One 16:9 participant tile, Discord-style: shows their video if they have
 * a camera/screen-share track, otherwise a centered avatar -- both get the
 * same name badge in the bottom-left corner. Always aspect-video so grid
 * cells stay uniform and nothing has to be cropped to a weird ratio.
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
  size: keyof typeof TILE_WIDTH;
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

  return (
    <div
      ref={containerRef}
      onClick={onFocus}
      className={`group relative aspect-video shrink-0 overflow-hidden rounded-2xl border bg-card transition ${TILE_WIDTH[size]} ${
        isSpeaking ? "border-primary shadow-[0_0_0_3px_rgba(255,183,3,0.3)]" : "border-border"
      } ${onFocus ? "cursor-pointer hover:border-primary" : ""} ${
        isFullscreen ? "!aspect-auto !h-screen !w-screen !max-h-none" : ""
      }`}
    >
      {trackRef ? (
        <VideoTrack
          trackRef={trackRef}
          className={`h-full w-full ${size === "focus" ? "object-contain bg-black" : "object-cover"}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-secondary/15">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/25 text-3xl">
            🐵
          </div>
        </div>
      )}

      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
        {isScreenShare && "🖥️ "}
        {isScreenShare ? `Tela de ${participant.name || participant.identity}` : participant.name || participant.identity}
        {!isScreenShare && isMuted && <span aria-hidden="true">🔇</span>}
      </span>

      {allowFullscreen && (
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
        >
          {isFullscreen ? "⤢" : "⛶"}
        </button>
      )}
    </div>
  );
}
