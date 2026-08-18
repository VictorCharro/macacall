"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrackToggle, useParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useCall } from "@/components/CallProvider";

export function MiniCallBar() {
  const { activeCall, leaveCall } = useCall();
  const pathname = usePathname();
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const participants = useParticipants();

  if (!activeCall) return null;

  const isViewingCall =
    pathname === `/bandos/${activeCall.bandoId}/${activeCall.channelId}`;

  if (isViewingCall) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-4 py-2.5 shadow-lg">
      <span className="animate-pulse text-lg">🌴</span>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-accent">
          {activeCall.channelName}
        </span>
        <span className="text-xs text-muted">
          {participants.length}{" "}
          {participants.length === 1 ? "macaco" : "macacos"} na call
        </span>
      </div>
      <button
        onClick={() => mic.toggle()}
        title={mic.enabled ? "Mic ligado" : "Mic mudo"}
        className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm transition ${
          mic.enabled
            ? "border-secondary bg-secondary/15 text-secondary"
            : "border-border bg-background text-muted"
        }`}
      >
        {mic.enabled ? "🎙️" : "🔇"}
      </button>
      <Link
        href={`/bandos/${activeCall.bandoId}/${activeCall.channelId}`}
        className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:brightness-95"
      >
        Voltar
      </Link>
      <button
        onClick={leaveCall}
        className="rounded-full bg-danger px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-90"
      >
        Sair
      </button>
    </div>
  );
}
