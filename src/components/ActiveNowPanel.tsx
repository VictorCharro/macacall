"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Mic } from "lucide-react";
import { usePresence } from "@/components/PresenceProvider";
import { STATUS_META } from "@/lib/presence";
import { avatarUrl } from "@/lib/avatar";

type Friend = { id: string; username: string; avatarSeed: string; avatarUrl: string | null };
type Activity = { friendId: string; bandoName: string; channelName: string };

export function ActiveNowPanel({ friends }: { friends: Friend[] }) {
  const { online } = usePresence();
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    let cancelled = false;

    // Pausado enquanto a aba não está visível -- não tem motivo de bater
    // nessa rota a cada poucos segundos com a aba em segundo plano, e
    // busca de novo na hora ao voltar pra não ficar com dado velho.
    async function poll() {
      if (document.hidden) return;
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

    function onVisibilityChange() {
      if (!document.hidden) poll();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const activityByFriend = useMemo(
    () => new Map(activity.map((a) => [a.friendId, a])),
    [activity],
  );
  const activeFriends = useMemo(
    () => friends.filter((f) => online.has(f.id) && online.get(f.id) !== "invisible"),
    [friends, online],
  );

  return (
    <aside className="scroll-hover hidden w-72 shrink-0 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain border-l border-border-soft bg-card p-4 lg:flex">
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
                  <Image
                    src={avatarUrl(friend.avatarSeed, friend.avatarUrl)}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized={!friend.avatarUrl}
                    className="h-9 w-9 rounded-full bg-background object-cover"
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
