"use client";

import { useEffect, useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { getUserProfile, type ViewedProfile } from "@/app/actions/profiles";
import { startDm } from "@/app/actions/dms";
import { colorFromSeed } from "@/lib/colorFromSeed";

/** Generic "click a name/avatar anywhere -> see their profile" popup. Fetches
 * on open instead of requiring every caller to plumb bio/banner/status down
 * through props they mostly don't otherwise need. */
export function UserProfileModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<ViewedProfile | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getUserProfile(userId).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-overlay-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-80 animate-modal-in overflow-hidden rounded-2xl border border-border bg-card-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {profile === undefined && (
          <div className="p-6 text-center text-sm text-muted">Carregando...</div>
        )}
        {profile === null && (
          <div className="p-6 text-center text-sm text-muted">
            Não encontrei esse macaco.
          </div>
        )}
        {profile && (
          <>
            <div
              className="relative h-20 w-full"
              style={{ backgroundColor: profile.bannerColor ?? colorFromSeed(profile.avatarSeed) }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative -mt-9 px-4 pb-4">
              <img
                src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(profile.avatarSeed)}`}
                alt=""
                className="h-18 w-18 rounded-full border-4 border-card-3 bg-card-2 shadow-xl"
              />

              <p className="mt-2 truncate text-lg font-black text-accent">
                {profile.username}
              </p>

              {profile.statusMessage && (
                <div className="mt-2 rounded-xl border border-border bg-card-2 p-2 text-xs text-foreground">
                  {profile.statusMessage}
                </div>
              )}

              {profile.bio && (
                <div className="mt-3 text-xs leading-relaxed text-muted">
                  <div className="mb-0.5 text-[10px] font-bold uppercase text-muted">
                    Sobre mim
                  </div>
                  {profile.bio}
                </div>
              )}

              {!profile.isSelf && (
                <form action={startDm.bind(null, profile.id)} className="mt-4">
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:brightness-110"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Mensagem
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
