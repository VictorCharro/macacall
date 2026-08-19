"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, MessageSquare, X, Phone } from "lucide-react";
import {
  respondFriendRequest,
  removeFriend,
} from "@/app/actions/friends";
import { startDm, startDmCall } from "@/app/actions/dms";
import { usePresence } from "@/components/PresenceProvider";
import { FriendRow, useEffectiveStatus } from "@/components/FriendRow";
import { AddFriendForm } from "@/components/AddFriendForm";
import { ActiveNowPanel } from "@/components/ActiveNowPanel";
import { FriendsSidebar } from "@/components/FriendsSidebar";
import { createRealtimeClient } from "@/lib/supabase/realtimeClient";
import type { PresenceStatus } from "@/lib/types";

type FriendEntry = {
  friendshipId: string;
  id: string;
  username: string;
  avatarSeed: string;
  status: PresenceStatus;
};

type DmEntry = {
  conversationId: string;
  id: string;
  username: string;
  avatarSeed: string;
  isGroup?: boolean;
};

type Tab = "online" | "todos" | "pendente" | "adicionar";

export function FriendsHome({
  currentUserId,
  selfUsername,
  selfAvatarSeed,
  friends,
  incoming,
  outgoing,
  dms,
}: {
  currentUserId: string;
  selfUsername: string;
  selfAvatarSeed: string;
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
  dms: DmEntry[];
}) {
  const [tab, setTab] = useState<Tab>("online");
  const router = useRouter();
  const { online } = usePresence();

  // "Invisible" reads as offline to everyone else, so it doesn't count here.
  const onlineCount = friends.filter((f) => {
    const status = online.get(f.id);
    return status && status !== "invisible";
  }).length;

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    createRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const channel = supabase
        .channel(`friendships:${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friendships",
            filter: `requester_id=eq.${currentUserId}`,
          },
          () => router.refresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friendships",
            filter: `addressee_id=eq.${currentUserId}`,
          },
          () => router.refresh(),
        )
        .subscribe();

      cleanup = () => supabase.removeChannel(channel);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [currentUserId, router]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <FriendsSidebar
        selfUsername={selfUsername}
        selfAvatarSeed={selfAvatarSeed}
        dms={dms}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 items-center gap-2 border-b border-border-soft bg-card px-4">
          <Users className="h-5 w-5 text-muted" />
          <h1 className="text-sm font-bold text-accent">Amigos</h1>
          <div className="ml-2 h-5 w-px bg-border-soft" />
          <div className="flex gap-1">
            {(
              [
                ["online", `Disponível (${onlineCount})`],
                ["todos", `Todos (${friends.length})`],
                ["pendente", `Pendente${incoming.length ? ` (${incoming.length})` : ""}`],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  tab === key
                    ? "bg-card-2 text-accent"
                    : "text-muted hover:text-accent"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTab("adicionar")}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                tab === "adicionar"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-secondary hover:bg-secondary/10"
              }`}
            >
              Adicionar amigo
            </button>
          </div>
        </header>

        <div className="scroll-hover min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-6 py-4">
          {tab === "adicionar" && <AddFriendForm />}

          {tab === "online" && (
            <FriendList
              friends={friends}
              count={onlineCount}
              filterOnline
              emptyTitle="Nenhum primata por aqui..."
              emptyLabel="Seus amigos devem estar colhendo banana ou jogando videogame."
            />
          )}

          {tab === "todos" && (
            <FriendList
              friends={friends}
              count={friends.length}
              emptyTitle="Sua selva está vazia"
              emptyLabel="Você ainda não tem amigos por aqui. Bora adicionar o primeiro!"
            />
          )}

          {tab === "pendente" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Recebidos — {incoming.length}
                </h2>
                {incoming.length === 0 ? (
                  <p className="text-sm text-muted">Nenhum pedido recebido.</p>
                ) : (
                  <ul className="flex flex-col">
                    {incoming.map((f) => (
                      <FriendRow key={f.friendshipId} friend={f}>
                        <button
                          type="button"
                          onClick={async () => {
                            await respondFriendRequest(f.friendshipId, true);
                            router.refresh();
                          }}
                          className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:brightness-95"
                        >
                          Aceitar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await respondFriendRequest(f.friendshipId, false);
                            router.refresh();
                          }}
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-card-2"
                        >
                          Recusar
                        </button>
                      </FriendRow>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Enviados — {outgoing.length}
                </h2>
                {outgoing.length === 0 ? (
                  <p className="text-sm text-muted">Nenhum pedido enviado.</p>
                ) : (
                  <ul className="flex flex-col">
                    {outgoing.map((f) => (
                      <FriendRow key={f.friendshipId} friend={f}>
                        <button
                          type="button"
                          onClick={async () => {
                            await removeFriend(f.friendshipId);
                            router.refresh();
                          }}
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-card-2"
                        >
                          Cancelar
                        </button>
                      </FriendRow>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ActiveNowPanel friends={friends} />
    </div>
  );
}

function FriendList({
  friends,
  count,
  filterOnline,
  emptyTitle,
  emptyLabel,
}: {
  friends: FriendEntry[];
  /** Already-filtered total, so the heading matches what actually renders. */
  count: number;
  filterOnline?: boolean;
  emptyTitle: string;
  emptyLabel: string;
}) {
  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 text-5xl">🐒💤</div>
        <h3 className="text-base font-bold text-foreground">{emptyTitle}</h3>
        <p className="mt-1 max-w-xs text-xs text-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-muted">
        Primatas — {count}
      </div>
      <ul className="flex flex-col">
        {friends.map((f) => (
          <ConditionalFriendRow
            key={f.friendshipId}
            friend={f}
            filterOnline={filterOnline}
          />
        ))}
      </ul>
    </div>
  );
}

function ConditionalFriendRow({
  friend,
  filterOnline,
}: {
  friend: FriendEntry;
  filterOnline?: boolean;
}) {
  const status = useEffectiveStatus(friend.id);
  const router = useRouter();

  if (filterOnline && !status) return null;

  return (
    <FriendRow friend={friend} enableContextMenu>
      <form action={startDm.bind(null, friend.id)}>
        <button
          type="submit"
          title="Enviar mensagem"
          aria-label="Enviar mensagem"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-muted transition hover:text-accent"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </form>
      <form action={startDmCall.bind(null, friend.id)}>
        <button
          type="submit"
          title="Ligar"
          aria-label="Ligar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-secondary transition hover:bg-secondary/30 hover:brightness-125"
        >
          <Phone className="h-4 w-4" />
        </button>
      </form>
      <button
        type="button"
        onClick={async () => {
          await removeFriend(friend.friendshipId);
          router.refresh();
        }}
        title="Remover amigo"
        aria-label="Remover amigo"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-muted transition hover:bg-danger/15 hover:text-danger"
      >
        <X className="h-4 w-4" />
      </button>
    </FriendRow>
  );
}
