"use client";

import { useState } from "react";
import { addDmParticipant } from "@/app/actions/dms";
import { Modal } from "@/components/Modal";

type Friend = { id: string; username: string; avatarSeed: string };

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
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-border/30"
            >
              <img
                src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(friend.avatarSeed)}`}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full bg-background"
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
