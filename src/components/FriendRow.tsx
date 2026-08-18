"use client";

import { usePresence } from "@/components/PresenceProvider";
import { STATUS_META } from "@/lib/presence";
import type { PresenceStatus } from "@/lib/types";

type FriendLike = {
  id: string;
  username: string;
  avatarSeed: string;
};

export function useEffectiveStatus(friendId: string) {
  const { online } = usePresence();
  const liveStatus = online.get(friendId);
  if (!liveStatus || liveStatus === "invisible") return null;
  return liveStatus;
}

export function FriendRow({
  friend,
  children,
}: {
  friend: FriendLike;
  children?: React.ReactNode;
}) {
  const status = useEffectiveStatus(friend.id);

  return (
    <li className="flex items-center gap-3 rounded-xl border-t border-border/60 px-2 py-3 transition hover:bg-border/20">
      <div className="relative shrink-0">
        <img
          src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(friend.avatarSeed)}`}
          alt=""
          className={`h-10 w-10 rounded-full bg-background ${status ? "" : "opacity-50 grayscale"}`}
        />
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${
            status ? STATUS_META[status as PresenceStatus].dotClass : "bg-muted"
          }`}
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {friend.username}
        </p>
        <p className="truncate text-xs text-muted">
          {status ? STATUS_META[status as PresenceStatus].label : "Offline"}
        </p>
      </div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </li>
  );
}
