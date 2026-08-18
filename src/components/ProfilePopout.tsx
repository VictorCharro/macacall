"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateStatusMessage } from "@/app/actions/friends";
import { usePresence } from "@/components/PresenceProvider";
import { colorFromSeed } from "@/lib/colorFromSeed";
import { randomStatusQuote } from "@/lib/statusQuotes";
import { STATUS_META } from "@/lib/presence";
import type { PresenceStatus } from "@/lib/types";

export function ProfilePopout({
  username,
  avatarSeed,
  onClose,
}: {
  username: string;
  avatarSeed: string;
  onClose: () => void;
}) {
  const { myStatus, setMyStatus } = usePresence();
  const popoutRef = useRef<HTMLDivElement>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [fallbackQuote] = useState(() => randomStatusQuote());
  const [statusFlyoutOpen, setStatusFlyoutOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("status_message")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setStatusMessage(data?.status_message ?? null);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoutRef.current && !popoutRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  function startEditing() {
    setDraft(statusMessage ?? "");
    setEditing(true);
  }

  async function saveStatusMessage() {
    const next = draft.trim();
    setEditing(false);
    setStatusMessage(next || null);
    await updateStatusMessage(next);
  }

  const bannerColor = colorFromSeed(avatarSeed);
  const displayedMessage = statusMessage || fallbackQuote;

  return (
    <div
      ref={popoutRef}
      className="absolute bottom-full left-0 z-30 mb-2 w-80 animate-modal-in rounded-xl border border-border bg-card shadow-lg"
    >
      <div className="h-16 w-full rounded-t-xl" style={{ backgroundColor: bannerColor }} />

      <div className="px-4 pb-4 pt-0">
        <div className="-mt-8 flex items-end">
          <div className="relative shrink-0">
            <img
              src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(avatarSeed)}`}
              alt=""
              className="h-16 w-16 rounded-full border-4 border-card bg-background"
            />
            <span
              className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${STATUS_META[myStatus].dotClass}`}
              aria-hidden="true"
            />
          </div>

          <div className="flex flex-1 justify-end pb-1">
            {loaded &&
              (editing ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={saveStatusMessage}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveStatusMessage();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEditing(false);
                    }
                  }}
                  maxLength={100}
                  placeholder="Escreva um status..."
                  className="w-40 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  title="Clique para editar seu status"
                  className="max-w-[11rem] truncate rounded-xl bg-background px-3 py-1.5 text-left text-xs text-foreground shadow transition hover:brightness-95"
                >
                  {displayedMessage}
                </button>
              ))}
          </div>
        </div>

        <p className="mt-3 truncate text-lg font-bold text-foreground">{username}</p>
        <p className="truncate text-xs text-muted">@{username.toLowerCase()}</p>

        {/* espaço reservado para bio (futuro) */}
        <div className="h-2" />

        <div className="my-3 h-px bg-border" />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Coleção de jogos
          </p>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-9 shrink-0 rounded-lg bg-border/40" />
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          <button
            type="button"
            disabled
            title="Em breve"
            className="flex w-full items-center gap-2 rounded-lg bg-background px-3 py-2 text-left text-sm text-muted"
          >
            <span aria-hidden="true">✏️</span>
            Editar perfil
            <span className="ml-auto rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
              Novo
            </span>
          </button>

          <div
            className="relative"
            onMouseEnter={() => setStatusFlyoutOpen(true)}
            onMouseLeave={() => setStatusFlyoutOpen(false)}
          >
            <button
              type="button"
              onClick={() => setStatusFlyoutOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-lg bg-background px-3 py-2 text-left text-sm text-foreground transition hover:bg-border/40"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${STATUS_META[myStatus].dotClass}`}
                aria-hidden="true"
              />
              {STATUS_META[myStatus].label}
              <span className="ml-auto text-muted">›</span>
            </button>

            {statusFlyoutOpen && (
              <div className="absolute left-full top-0 z-40 ml-2 w-64 animate-modal-in rounded-xl border border-border bg-card p-1.5 shadow-lg">
                {(Object.keys(STATUS_META) as PresenceStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setMyStatus(status);
                      setStatusFlyoutOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-border/40 ${
                      status === myStatus ? "font-semibold text-accent" : "text-foreground"
                    }`}
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_META[status].dotClass}`}
                      aria-hidden="true"
                    />
                    <span>
                      <span className="block">{STATUS_META[status].label}</span>
                      {STATUS_META[status].subtitle && (
                        <span className="block text-xs text-muted">
                          {STATUS_META[status].subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
