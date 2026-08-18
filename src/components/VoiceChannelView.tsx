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
    <div className="macacall-call flex flex-1 flex-col overflow-hidden">
      <CallInterface channelName={channelName} />
    </div>
  );
}

export function CallInterface({
  channelName,
  compact = false,
}: {
  channelName: string;
  /** Used when a persistent text chat already exists alongside the call
   * (DMs): docks a shorter call strip with no header/in-call chat, since
   * that would just duplicate the DM's own message thread. */
  compact?: boolean;
}) {
  const { leaveCall, micEnabled, toggleMic } = useCall();
  const [chatOpen, setChatOpen] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const participants = useParticipants();
  const videoTracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const trackKey = (t: TrackReference) => `${t.participant.identity}:${t.source}`;
  const screenShareTrack = videoTracks.find((t) => t.source === Track.Source.ScreenShare);

  const videoParticipantKeys = new Set(
    videoTracks.map((t) => `${t.participant.identity}:${t.source}`),
  );
  const voiceOnlyParticipants = participants.filter(
    (p) => !videoParticipantKeys.has(`${p.identity}:${Track.Source.Camera}`),
  );

  // Whoever the user last clicked stays focused; if that track disappears
  // (they hung up / stopped sharing) fall back to the active screen share,
  // then to the first video track, then no focus at all (voice-only).
  const availableKeys = new Set(videoTracks.map(trackKey));
  const resolvedFocusKey =
    focusedKey && availableKeys.has(focusedKey)
      ? focusedKey
      : screenShareTrack
        ? trackKey(screenShareTrack)
        : (videoTracks[0] ? trackKey(videoTracks[0]) : null);

  const focusedTrack = videoTracks.find((t) => trackKey(t) === resolvedFocusKey) ?? null;
  const thumbnailTracks = videoTracks.filter((t) => trackKey(t) !== resolvedFocusKey);

  const cam = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({ source: Track.Source.ScreenShare });

  return (
    <div className={compact ? "flex flex-col border-b border-border bg-card/60" : "flex h-full flex-col"}>
      {!compact && (
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <h1 className="font-semibold text-accent">
            🌴 {channelName} · {participants.length}{" "}
            {participants.length === 1 ? "macaco" : "macacos"}
          </h1>
        </header>
      )}

      <div className="flex overflow-hidden">
        {compact ? (
          <div className="flex flex-1 flex-col gap-2 p-3">
            {focusedTrack && (
              <VideoTile trackRef={focusedTrack} size="focus" allowFullscreen />
            )}
            {(thumbnailTracks.length > 0 || voiceOnlyParticipants.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {thumbnailTracks.map((trackRef) => (
                  <VideoTile
                    key={trackKey(trackRef)}
                    trackRef={trackRef}
                    size={focusedTrack ? "thumb" : "medium"}
                    onFocus={() => setFocusedKey(trackKey(trackRef))}
                  />
                ))}
                {voiceOnlyParticipants.map((participant) => (
                  <AvatarChip key={participant.identity} participant={participant} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
            {videoTracks.map((trackRef) => (
              <VideoTile
                key={`${trackRef.participant.identity}:${trackRef.source}`}
                trackRef={trackRef}
                size="grid"
              />
            ))}
            {voiceOnlyParticipants.map((participant) => (
              <AvatarTile key={participant.identity} participant={participant} />
            ))}
          </div>
        )}

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

const VIDEO_TILE_SIZE = {
  // large focused screen share, dm call strip -- aspect-video instead of a
  // fixed height keeps the box in the same proportions as the video itself,
  // so object-contain never has to crop it
  focus: "w-full aspect-video max-h-[60vh]",
  // camera thumbnail next to a screen share focus, dm call strip
  thumb: "h-20 w-32 sm:h-24 sm:w-40",
  // camera tile with no screen share around, dm call strip
  medium: "h-36 w-56 sm:h-48 sm:w-72",
  // full voice-channel page grid (sized by the CSS grid itself)
  grid: "h-full w-full",
} as const;

function VideoTile({
  trackRef,
  size,
  onFocus,
  allowFullscreen,
}: {
  trackRef: TrackReference;
  size: keyof typeof VIDEO_TILE_SIZE;
  /** Present on thumbnails: clicking swaps this track into the focus spot. */
  onFocus?: () => void;
  allowFullscreen?: boolean;
}) {
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      className={`group relative shrink-0 overflow-hidden rounded-2xl border border-border bg-black ${VIDEO_TILE_SIZE[size]} ${
        size === "grid" && isScreenShare ? "col-span-2 row-span-2" : ""
      } ${onFocus ? "cursor-pointer transition hover:border-primary" : ""} ${
        isFullscreen ? "!aspect-auto !h-screen !w-screen !max-h-none" : ""
      }`}
    >
      <VideoTrack
        trackRef={trackRef}
        className={`h-full w-full ${size === "focus" ? "object-contain" : "object-cover"}`}
      />
      <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
        {isScreenShare
          ? `🖥️ Tela de ${trackRef.participant.name || trackRef.participant.identity}`
          : trackRef.participant.name || trackRef.participant.identity}
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

function AvatarTile({ participant }: { participant: Participant }) {
  const { isMuted } = useTrackMutedIndicator({
    participant,
    source: Track.Source.Microphone,
  });
  const isSpeaking = useIsSpeaking(participant);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-6 transition ${
        isSpeaking ? "border-primary shadow-[0_0_0_3px_rgba(255,183,3,0.3)]" : "border-border"
      }`}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 text-3xl">
        🐵
      </div>
      <span className="max-w-full truncate text-sm font-medium text-accent">
        {participant.name || participant.identity}
      </span>
      <span className="text-xs text-muted">{isMuted ? "🔇" : "🎙️"}</span>
    </div>
  );
}

/** Small circular chip for voice-only participants in the compact DM call strip. */
function AvatarChip({ participant }: { participant: Participant }) {
  const { isMuted } = useTrackMutedIndicator({
    participant,
    source: Track.Source.Microphone,
  });
  const isSpeaking = useIsSpeaking(participant);

  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-secondary/20 text-2xl transition ${
          isSpeaking ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
        }`}
      >
        🐵
      </div>
      <span className="flex max-w-full items-center gap-0.5 truncate text-xs text-muted">
        {isMuted && <span aria-hidden="true">🔇</span>}
        <span className="truncate">{participant.name || participant.identity}</span>
      </span>
    </div>
  );
}
