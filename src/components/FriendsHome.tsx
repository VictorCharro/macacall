"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, MessageSquare, X } from "lucide-react";
import {
  respondFriendRequest,
  removeFriend,
} from "@/app/actions/friends";
import { startDm } from "@/app/actions/dms";
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
    <div className="flex flex-1 overflow-hidden">
      <FriendsSidebar
        selfUsername={selfUsername}
        selfAvatarSeed={selfAvatarSeed}
        dms={dms}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 items-center gap-2 border-b border-border-soft bg-card px-4">
          <Users className="h-5 w-5 text-muted" />
          <h1 className="text-sm font-bold text-accent">Amigos</h1>
          <div className="ml-2 h-5 w-px bg-border-soft" />
          <div className="flex gap-1">
            {(
              [
                ["online", "Disponível"],
                ["todos", "Todos"],
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "adicionar" && <AddFriendForm />}

          {tab === "online" && (
            <FriendList
              friends={friends}
              filterOnline
              emptyLabel="Ninguém online agora 🍃"
            />
          )}

          {tab === "todos" && (
            <FriendList friends={friends} emptyLabel="Você ainda não tem amigos. Adicione um! 🐒" />
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
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-border/40"
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
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:bg-border/40"
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
  filterOnline,
  emptyLabel,
}: {
  friends: FriendEntry[];
  filterOnline?: boolean;
  emptyLabel: string;
}) {
  if (friends.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col">
      {friends.map((f) => (
        <ConditionalFriendRow
          key={f.friendshipId}
          friend={f}
          filterOnline={filterOnline}
        />
      ))}
    </ul>
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
