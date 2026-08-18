"use client";

import { useEffect, useState } from "react";
import { inviteFriendToBando } from "@/app/actions/dms";
import { Modal } from "@/components/Modal";

type Bando = { id: string; name: string };

export function InviteToBandoModal({
  friendId,
  friendUsername,
  onClose,
}: {
  friendId: string;
  friendUsername: string;
  onClose: () => void;
}) {
  const [bandos, setBandos] = useState<Bando[] | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/my-bandos")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBandos(data.bandos ?? []);
      })
      .catch(() => {
        if (!cancelled) setBandos([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-accent">
        Convidar {friendUsername} para o servidor
      </h3>
      <p className="mt-1 text-sm text-muted">
        Vamos mandar o link de convite numa DM.
      </p>

      {bandos === null ? (
        <p className="mt-4 text-sm text-muted">carregando...</p>
      ) : bandos.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Você ainda não tem nenhum bando.</p>
      ) : (
        <ul className="mt-4 flex max-h-72 flex-col gap-1 overflow-y-auto">
          {bandos.map((bando) => (
            <li
              key={bando.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-border/30"
            >
              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {bando.name}
              </span>
              <button
                type="button"
                disabled={sendingId === bando.id}
                onClick={async () => {
                  setSendingId(bando.id);
                  setError(null);
                  const result = await inviteFriendToBando(friendId, bando.id);
                  setSendingId(null);
                  if (result.error) setError(result.error);
                  else setSentId(bando.id);
                }}
                className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-95 disabled:opacity-60"
              >
                {sendingId === bando.id
                  ? "Enviando..."
                  : sentId === bando.id
                    ? "Enviado! ✅"
                    : "Convidar"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}
