"use client";

import { useCall } from "@/components/CallProvider";

export function UserPanel({
  username,
  avatarSeed,
}: {
  username: string;
  avatarSeed: string;
}) {
  const { connected, micEnabled, deafened, toggleMic, toggleDeafen } =
    useCall();

  return (
    <div className="flex items-center gap-1.5 border-t border-border bg-card/80 px-3 py-2">
      <img
        src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(avatarSeed)}`}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full bg-background"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {username}
        </p>
        <p className="truncate text-xs text-muted">
          {connected ? "Em voz" : "Desconectado"}
        </p>
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
        disabled
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-muted opacity-50"
      >
        ⚙️
      </button>
    </div>
  );
}
