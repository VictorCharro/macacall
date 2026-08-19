"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EditProfileModal } from "@/components/EditProfileModal";
import { updateStatusMessage } from "@/app/actions/friends";
import { usePresence } from "@/components/PresenceProvider";
import { colorFromSeed } from "@/lib/colorFromSeed";
import { randomStatusQuote } from "@/lib/statusQuotes";
import { STATUS_META } from "@/lib/presence";
import { ContextMenuPortal } from "@/components/ContextMenuPortal";
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
  const statusRowRef = useRef<HTMLDivElement>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [bannerColorOverride, setBannerColorOverride] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [fallbackQuote] = useState(() => randomStatusQuote());
  const [statusFlyoutPos, setStatusFlyoutPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  function openStatusFlyout() {
    const rect = statusRowRef.current?.getBoundingClientRect();
    if (!rect) return;
    setStatusFlyoutPos({ x: rect.right + 8, y: rect.top });
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("status_message, bio, banner_color")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setStatusMessage(data?.status_message ?? null);
        setBio(data?.bio ?? null);
        setBannerColorOverride(data?.banner_color ?? null);
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

  const bannerColor = bannerColorOverride ?? colorFromSeed(avatarSeed);
  const displayedMessage = statusMessage || fallbackQuote;

  return (
    <div
      ref={popoutRef}
      className="absolute bottom-full left-0 z-30 mb-2 w-80 animate-modal-in rounded-xl border border-border bg-card shadow-lg"
    >
      <div className="h-16 w-full rounded-t-xl" style={{ backgroundColor: bannerColor }} />

      <div className="px-4 pb-4 pt-0">
        <div className="-mt-8 flex items-end gap-1.5">
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

          {loaded && (
            <>
              <span
                className="mb-1 h-3 w-3 shrink-0 rounded-full bg-card-3"
                aria-hidden="true"
              />
              <span
                className="mb-5 h-1.5 w-1.5 shrink-0 rounded-full bg-card-3"
                aria-hidden="true"
              />
            </>
          )}

          <div className="flex pb-7">
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
                  className="w-48 rounded-[1.5rem] border border-border bg-card-3 px-4 py-3 text-sm text-white outline-none focus:border-primary"
                />
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  title="Clique para editar seu status"
                  style={{
                    borderRadius: "60% 70% 65% 75% / 70% 60% 75% 65%",
                  }}
                  className="group flex max-w-[14rem] items-center gap-2.5 bg-card-3 px-4 py-3 shadow-lg transition hover:brightness-110"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card-2 text-xs text-white/70 group-hover:text-white">
                    {statusMessage ? "✎" : "+"}
                  </span>
                  <span className="truncate text-left text-sm text-white/90">
                    {displayedMessage}
                  </span>
                </button>
              ))}
          </div>
        </div>

        <p className="mt-3 truncate text-lg font-bold text-foreground">{username}</p>
        <p className="truncate text-xs text-muted">@{username.toLowerCase()}</p>

        {bio ? (
          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">
            {bio}
          </p>
        ) : (
          <div className="h-2" />
        )}

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
            onClick={() => setEditProfileOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg bg-background px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2"
          >
            <Pencil className="h-4 w-4 text-muted" />
            Editar perfil
            <span className="ml-auto rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
              Novo
            </span>
          </button>

          <div
            ref={statusRowRef}
            onMouseEnter={openStatusFlyout}
            onMouseLeave={() => setStatusFlyoutPos(null)}
          >
            <button
              type="button"
              onClick={() =>
                statusFlyoutPos ? setStatusFlyoutPos(null) : openStatusFlyout()
              }
              className="flex w-full items-center gap-2 rounded-lg bg-background px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${STATUS_META[myStatus].dotClass}`}
                aria-hidden="true"
              />
              {STATUS_META[myStatus].label}
              <span className="ml-auto text-muted">›</span>
            </button>
          </div>
        </div>
      </div>

      {statusFlyoutPos && (
        <ContextMenuPortal
          x={statusFlyoutPos.x}
          y={statusFlyoutPos.y}
          onClose={() => setStatusFlyoutPos(null)}
        >
          <div
            onMouseEnter={() => openStatusFlyout()}
            onMouseLeave={() => setStatusFlyoutPos(null)}
            className="w-64"
          >
            {(Object.keys(STATUS_META) as PresenceStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setMyStatus(status);
                  setStatusFlyoutPos(null);
                }}
                className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-card-2 ${
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
        </ContextMenuPortal>
      )}

      {editProfileOpen && (
        <EditProfileModal
          username={username}
          avatarSeed={avatarSeed}
          initialBio={bio}
          initialBannerColor={bannerColorOverride}
          onSaved={(nextBio, nextBanner) => {
            setBio(nextBio);
            setBannerColorOverride(nextBanner);
          }}
          onClose={() => setEditProfileOpen(false)}
        />
      )}
    </div>
  );
}
