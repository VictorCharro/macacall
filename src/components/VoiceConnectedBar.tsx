"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useCall } from "@/components/CallProvider";

export function VoiceConnectedBar() {
  const { activeCall, connected } = useCall();
  const pathname = usePathname();

  if (!connected || !activeCall) return null;

  const channelHref = `/bandos/${activeCall.bandoId}/${activeCall.channelId}`;
  if (pathname === channelHref) return null;

  return (
    <ConnectedBarContent
      channelHref={channelHref}
      channelName={activeCall.channelName}
    />
  );
}

function ConnectedBarContent({
  channelHref,
  channelName,
}: {
  channelHref: string;
  channelName: string;
}) {
  const { leaveCall } = useCall();
  const cam = useTrackToggle({ source: Track.Source.Camera });
  const screen = useTrackToggle({ source: Track.Source.ScreenShare });

  return (
    <div className="m-2 flex flex-col gap-2 rounded-xl border border-secondary/30 bg-secondary/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={channelHref} className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
            <span aria-hidden="true">📶</span>
            Voz conectada
          </p>
          <p className="truncate text-xs text-muted">Call · {channelName}</p>
        </Link>
        <button
          type="button"
          onClick={leaveCall}
          title="Desconectar"
          aria-label="Desconectar da call"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger text-xs text-white transition hover:brightness-90"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <IconToggle
          active={cam.enabled}
          onClick={() => cam.toggle()}
          label={cam.enabled ? "Desligar câmera" : "Ligar câmera"}
          icon="📷"
        />
        <IconToggle
          active={screen.enabled}
          onClick={() => screen.toggle()}
          label={screen.enabled ? "Parar tela" : "Compartilhar tela"}
          icon="🖥️"
        />
      </div>
    </div>
  );
}

function IconToggle({
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
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition ${
        active
          ? "bg-secondary/20 text-secondary"
          : "bg-background text-muted hover:text-accent"
      }`}
    >
      {icon}
    </button>
  );
}
