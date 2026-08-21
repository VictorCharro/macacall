"use client";

import { useState } from "react";
import { addDmParticipant } from "@/app/actions/dms";
import { Modal } from "@/components/Modal";
import { avatarUrl } from "@/lib/avatar";

type Friend = { id: string; username: string; avatarSeed: string; avatarUrl: string | null };

export function AddDmParticipantModal({
  conversationId,
  availableFriends,
  onClose,
}: {
  conversationId: string;
  availableFriends: Friend[];
  onClose: () => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-accent">Adicionar à conversa</h3>

      {availableFriends.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Todos os seus amigos já estão nessa conversa 🐒
        </p>
      ) : (
        <ul className="mt-3 flex max-h-80 flex-col gap-1 overflow-y-auto">
          {availableFriends.map((friend) => (
            <li
              key={friend.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-card-2"
            >
              <img
                src={avatarUrl(friend.avatarSeed, friend.avatarUrl)}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full bg-background object-cover"
              />
              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {friend.username}
              </span>
              <button
                type="button"
                disabled={adding === friend.id}
                onClick={async () => {
                  setAdding(friend.id);
                  setError(null);
                  const result = await addDmParticipant(
                    conversationId,
                    friend.id,
                  );
                  setAdding(null);
                  if (result.error) setError(result.error);
                  else onClose();
                }}
                className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-95 disabled:opacity-60"
              >
                {adding === friend.id ? "Adicionando..." : "Adicionar"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}
