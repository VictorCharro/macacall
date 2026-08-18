"use client";

import { useState } from "react";
import {
  respondFriendRequest,
  removeFriend,
} from "@/app/actions/friends";
import { startDm } from "@/app/actions/dms";
import { FriendRow, useEffectiveStatus } from "@/components/FriendRow";
import { AddFriendForm } from "@/components/AddFriendForm";
import { ActiveNowPanel } from "@/components/ActiveNowPanel";
import { FriendsSidebar } from "@/components/FriendsSidebar";
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
  status: PresenceStatus;
};

type Tab = "online" | "todos" | "pendente" | "adicionar";

export function FriendsHome({
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

  return (
    <div className="flex flex-1 overflow-hidden">
      <FriendsSidebar
        selfUsername={selfUsername}
        selfAvatarSeed={selfAvatarSeed}
        dms={dms}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border bg-card px-6 py-3">
          <span aria-hidden="true">🐒</span>
          <h1 className="font-semibold text-accent">Amigos</h1>
          <div className="ml-4 h-5 w-px bg-border" />
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
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === key
                    ? "bg-border/60 text-accent"
                    : "text-muted hover:bg-border/30 hover:text-accent"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTab("adicionar")}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                tab === "adicionar"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:brightness-95"
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
                          onClick={() => respondFriendRequest(f.friendshipId, true)}
                          className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:brightness-95"
                        >
                          Aceitar
                        </button>
                        <button
                          type="button"
                          onClick={() => respondFriendRequest(f.friendshipId, false)}
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
                          onClick={() => removeFriend(f.friendshipId)}
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

  if (filterOnline && !status) return null;

  return (
    <FriendRow friend={friend}>
      <form action={startDm.bind(null, friend.id)}>
        <button
          type="submit"
          title="Enviar mensagem"
          aria-label="Enviar mensagem"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-muted transition hover:bg-border/40 hover:text-accent"
        >
          💬
        </button>
      </form>
      <button
        type="button"
        onClick={() => removeFriend(friend.friendshipId)}
        title="Remover amigo"
        aria-label="Remover amigo"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-muted transition hover:bg-danger/15 hover:text-danger"
      >
        ✕
      </button>
    </FriendRow>
  );
}
