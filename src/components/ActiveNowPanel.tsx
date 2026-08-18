"use client";

import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { usePresence } from "@/components/PresenceProvider";
import { STATUS_META } from "@/lib/presence";

type Friend = { id: string; username: string; avatarSeed: string };
type Activity = { friendId: string; bandoName: string; channelName: string };

export function ActiveNowPanel({ friends }: { friends: Friend[] }) {
  const { online } = usePresence();
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/friends/activity");
        const data = await res.json();
        if (!cancelled) setActivity(data.activity ?? []);
      } catch {
        // silencioso
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const activityByFriend = new Map(activity.map((a) => [a.friendId, a]));
  const activeFriends = friends.filter(
    (f) => online.has(f.id) && online.get(f.id) !== "invisible",
  );

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border-soft bg-card p-4 lg:flex">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Ativo agora
      </h2>

      {activeFriends.length === 0 ? (
        <p className="text-sm text-muted">
          Ninguém do seu bando de amigos tá online agora 🍃
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {activeFriends.map((friend) => {
            const inCall = activityByFriend.get(friend.id);
            const status = online.get(friend.id);
            return (
              <li
                key={friend.id}
                className="flex items-center gap-3 rounded-xl border border-border-soft bg-card-2 p-2.5"
              >
                <div className="relative shrink-0">
                  <img
                    src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(friend.avatarSeed)}`}
                    alt=""
                    className="h-9 w-9 rounded-full bg-background"
                  />
                  <span
                    className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${
                      status ? STATUS_META[status].dotClass : "bg-muted"
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {friend.username}
                  </p>
                  {inCall ? (
                    <p className="flex items-center gap-1 truncate text-xs text-secondary">
                      <Mic className="h-3 w-3 shrink-0" />
                      {inCall.bandoName} · {inCall.channelName}
                    </p>
                  ) : (
                    <p className="truncate text-xs text-muted">
                      {status ? STATUS_META[status].label : ""}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
