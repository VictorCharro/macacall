"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useCall } from "@/components/CallProvider";
import { PingIndicator } from "@/components/PingIndicator";
import { VoiceIconButton } from "@/components/VoiceIconButton";

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
      <div className="flex items-center gap-2">
        <PingIndicator />

        <Link href={channelHref} className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-secondary">
            Voz conectada
          </p>
          <p className="truncate text-xs text-muted">Call · {channelName}</p>
        </Link>

        <VoiceIconButton label="Supressor de ruído" sublabel="Em breve" disabled>
          <NoiseWaveIcon />
        </VoiceIconButton>

        <VoiceIconButton
          onClick={leaveCall}
          danger
          label="Desconectar"
          sublabel={`Call · ${channelName}`}
        >
          <span aria-hidden="true">📞</span>
        </VoiceIconButton>
      </div>

      <div className="flex items-center gap-1.5">
        <VoiceIconButton
          active={cam.enabled}
          onClick={() => cam.toggle()}
          label={cam.enabled ? "Desligar câmera" : "Transmitir câmera"}
        >
          <span aria-hidden="true">📷</span>
        </VoiceIconButton>
        <VoiceIconButton
          active={screen.enabled}
          onClick={() => screen.toggle()}
          label={screen.enabled ? "Parar de compartilhar" : "Compartilhar a tela"}
        >
          <span aria-hidden="true">🖥️</span>
        </VoiceIconButton>
      </div>
    </div>
  );
}

function NoiseWaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1 8c1-2 2-3 3-3s2 4 3 4 1-6 2-6 2 6 3 6 2-3 3-1"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
