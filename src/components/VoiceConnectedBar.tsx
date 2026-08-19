"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { PhoneOff, Video, MonitorUp, Wand2 } from "lucide-react";
import { useCall } from "@/components/CallProvider";
import { PingIndicator } from "@/components/PingIndicator";
import { VoiceIconButton } from "@/components/VoiceIconButton";

export function VoiceConnectedBar() {
  const { activeCall, connected } = useCall();
  const pathname = usePathname();

  if (!connected || !activeCall) return null;
  if (pathname === activeCall.href) return null;

  return (
    <ConnectedBarContent
      channelHref={activeCall.href}
      channelName={activeCall.roomName}
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
  const screen = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: { audio: true },
  });

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
          <Wand2 className="h-4 w-4" />
        </VoiceIconButton>

        <VoiceIconButton
          onClick={leaveCall}
          danger
          label="Desconectar"
          sublabel={`Call · ${channelName}`}
        >
          <PhoneOff className="h-4 w-4" />
        </VoiceIconButton>
      </div>

      <div className="flex items-center gap-1.5">
        <VoiceIconButton
          active={cam.enabled}
          onClick={() => cam.toggle()}
          label={cam.enabled ? "Desligar câmera" : "Transmitir câmera"}
        >
          <Video className="h-4 w-4" />
        </VoiceIconButton>
        <VoiceIconButton
          active={screen.enabled}
          onClick={() => screen.toggle()}
          label={screen.enabled ? "Parar de compartilhar" : "Compartilhar a tela"}
        >
          <MonitorUp className="h-4 w-4" />
        </VoiceIconButton>
        <VoiceIconButton label="Filtro de voz" sublabel="Em breve" disabled>
          <span aria-hidden="true">🐵</span>
        </VoiceIconButton>
      </div>
    </div>
  );
}
