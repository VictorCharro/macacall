"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (activeCall?.channelId !== channelId) {
      joinCall(bandoId, channelId, channelName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const isThisChannel = activeCall?.channelId === channelId;

  if (isThisChannel && error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-danger">{error}</p>
        <button
          onClick={() => joinCall(bandoId, channelId, channelName)}
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
          onClick={() => joinCall(bandoId, channelId, channelName)}
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

function CallInterface({ channelName }: { channelName: string }) {
  const { leaveCall } = useCall();
  const [chatOpen, setChatOpen] = useState(false);
  const participants = useParticipants();
  const videoTracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);

  const videoParticipantKeys = new Set(
    videoTracks.map((t) => `${t.participant.identity}:${t.source}`),
  );
  const voiceOnlyParticipants = participants.filter(
    (p) => !videoParticipantKeys.has(`${p.identity}:${Track.Source.Camera}`),
  );

  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const cam = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({ source: Track.Source.ScreenShare });

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <h1 className="font-semibold text-accent">
          🌴 {channelName} · {participants.length}{" "}
          {participants.length === 1 ? "macaco" : "macacos"}
        </h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
          {videoTracks.map((trackRef) => (
            <VideoTile key={`${trackRef.participant.identity}:${trackRef.source}`} trackRef={trackRef} />
          ))}
          {voiceOnlyParticipants.map((participant) => (
            <AvatarTile key={participant.identity} participant={participant} />
          ))}
        </div>

        {chatOpen && (
          <div className="w-72 flex-shrink-0 border-l border-border bg-card">
            <Chat style={{ height: "100%" }} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-border bg-card px-4 py-3">
        <ControlButton
          active={mic.enabled}
          onClick={() => mic.toggle()}
          label={mic.enabled ? "Mic ligado" : "Mic mudo"}
          icon={mic.enabled ? "🎙️" : "🔇"}
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
        <ControlButton
          active={chatOpen}
          onClick={() => setChatOpen((v) => !v)}
          label="Chat"
          icon="💬"
        />
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

function VideoTile({ trackRef }: { trackRef: TrackReference }) {
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-black ${
        isScreenShare ? "col-span-2 row-span-2" : ""
      }`}
    >
      <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
      <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
        {isScreenShare
          ? `🖥️ Tela de ${trackRef.participant.name || trackRef.participant.identity}`
          : trackRef.participant.name || trackRef.participant.identity}
      </span>
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
