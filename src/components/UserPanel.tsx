"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Headphones, VolumeX, Settings } from "lucide-react";
import { useCall } from "@/components/CallProvider";
import { usePresence } from "@/components/PresenceProvider";
import { STATUS_META } from "@/lib/presence";
import type { PresenceStatus } from "@/lib/types";

export function UserPanel({
  username,
  avatarSeed,
}: {
  username: string;
  avatarSeed: string;
}) {
  const { connected, micEnabled, deafened, toggleMic, toggleDeafen } =
    useCall();
  const { myStatus, setMyStatus } = usePresence();
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statusMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setStatusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [statusMenuOpen]);

  return (
    <div className="flex items-center gap-1.5 border-t border-border-soft bg-card-3 px-2 py-2">
      <div className="relative shrink-0">
        <img
          src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(avatarSeed)}`}
          alt=""
          className="h-8 w-8 rounded-full bg-background border border-secondary/40"
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

      <button
        type="button"
        onClick={toggleMic}
        title={micEnabled ? "Mutar microfone" : "Ativar microfone"}
        aria-label={micEnabled ? "Mutar microfone" : "Ativar microfone"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
          micEnabled
            ? "text-muted hover:bg-card-2 hover:text-accent"
            : "bg-danger/15 text-danger"
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
            ? "bg-danger/15 text-danger"
            : "text-muted hover:bg-card-2 hover:text-accent"
        }`}
      >
        {deafened ? <VolumeX className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
      </button>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setStatusMenuOpen((v) => !v)}
          title="Status"
          aria-label="Mudar status"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-card-2 hover:text-accent"
        >
          <Settings className="h-4 w-4" />
        </button>

        {statusMenuOpen && (
          <div className="absolute bottom-full right-0 z-30 mb-2 min-w-[11rem] animate-modal-in rounded-xl border border-border bg-card-2 p-1.5 shadow-lg">
            {(Object.keys(STATUS_META) as PresenceStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setMyStatus(status);
                  setStatusMenuOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition hover:bg-card ${
                  status === myStatus
                    ? "font-semibold text-accent"
                    : "text-foreground"
                }`}
              >
                <span aria-hidden="true">{STATUS_META[status].emoji}</span>
                {STATUS_META[status].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
