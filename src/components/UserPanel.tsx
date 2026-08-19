"use client";

import { useState } from "react";
import { Mic, MicOff, Headphones, VolumeX, Settings } from "lucide-react";
import { useCall } from "@/components/CallProvider";
import { usePresence } from "@/components/PresenceProvider";
import { ProfilePopout } from "@/components/ProfilePopout";
import { STATUS_META } from "@/lib/presence";

export function UserPanel({
  username,
  avatarSeed,
}: {
  username: string;
  avatarSeed: string;
}) {
  const { connected, micEnabled, deafened, forceMuted, toggleMic, toggleDeafen } =
    useCall();
  const { myStatus } = usePresence();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5 border-t border-border-soft bg-card-3 px-2 py-2">
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          className="flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1 py-1 text-left transition hover:bg-card-2"
        >
          <div className="relative shrink-0">
            <img
              src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(avatarSeed)}`}
              alt=""
              className="h-8 w-8 rounded-full border border-secondary/40 bg-background"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card-3 ${STATUS_META[myStatus].dotClass}`}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-foreground">
              {username}
            </p>
            <p className="truncate text-[10px] text-muted">
              {connected ? "Em voz" : STATUS_META[myStatus].label}
            </p>
          </div>
        </button>

        {profileOpen && (
          <ProfilePopout
            username={username}
            avatarSeed={avatarSeed}
            onClose={() => setProfileOpen(false)}
          />
        )}
      </div>

      <button
        type="button"
        onClick={toggleMic}
        disabled={forceMuted}
        title={
          forceMuted
            ? "Mutado por um moderador"
            : micEnabled
              ? "Mutar microfone"
              : "Ativar microfone"
        }
        aria-label={
          forceMuted
            ? "Mutado por um moderador"
            : micEnabled
              ? "Mutar microfone"
              : "Ativar microfone"
        }
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition disabled:cursor-not-allowed ${
          micEnabled
            ? "text-muted hover:bg-card-2 hover:text-accent"
            : forceMuted
              ? "bg-danger/15 text-danger"
              : "bg-card-2 text-muted"
        }`}
      >
        {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
      </button>

      <button
        type="button"
        onClick={toggleDeafen}
        title={deafened ? "Voltar a ouvir" : "Parar de ouvir (surdo)"}
        aria-label={deafened ? "Voltar a ouvir" : "Parar de ouvir (surdo)"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
          deafened
            ? "bg-card-2 text-muted"
            : "text-muted hover:bg-card-2 hover:text-accent"
        }`}
      >
        {deafened ? <VolumeX className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
      </button>

      <button
        type="button"
        title="Configurações (em breve)"
        aria-label="Configurações"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card-2 hover:text-accent"
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  );
}
