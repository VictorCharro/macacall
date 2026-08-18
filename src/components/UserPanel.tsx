"use client";

import { useState } from "react";
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
  const { connected, micEnabled, deafened, toggleMic, toggleDeafen } =
    useCall();
  const { myStatus } = usePresence();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5 border-t border-border bg-card/80 px-3 py-2">
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          className="flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1 py-1 text-left transition hover:bg-yellow-200/20"
        >
          <div className="relative shrink-0">
            <img
              src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(avatarSeed)}`}
              alt=""
              className="h-9 w-9 rounded-full bg-background"
            />
            <span
              className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${STATUS_META[myStatus].dotClass}`}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {username}
            </p>
            <p className="truncate text-xs text-muted">
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
        title={micEnabled ? "Mutar microfone" : "Ativar microfone"}
        aria-label={micEnabled ? "Mutar microfone" : "Ativar microfone"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm transition ${
          micEnabled
            ? "text-muted hover:bg-border/40 hover:text-accent"
            : "bg-danger/15 text-danger"
        }`}
      >
        {micEnabled ? "🎙️" : "🔇"}
      </button>

      <button
        type="button"
        onClick={toggleDeafen}
        title={deafened ? "Voltar a ouvir" : "Parar de ouvir (surdo)"}
        aria-label={deafened ? "Voltar a ouvir" : "Parar de ouvir (surdo)"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm transition ${
          deafened
            ? "bg-danger/15 text-danger"
            : "text-muted hover:bg-border/40 hover:text-accent"
        }`}
      >
        {deafened ? "🔕" : "🎧"}
      </button>

      <button
        type="button"
        title="Configurações (em breve)"
        aria-label="Configurações"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-muted transition hover:bg-border/40 hover:text-accent"
      >
        ⚙️
      </button>
    </div>
  );
}
