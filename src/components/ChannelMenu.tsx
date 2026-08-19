"use client";

import { useActionState, useEffect, useState } from "react";
import {
  renameChannel,
  deleteChannel,
  updateChannelTopic,
} from "@/app/actions/channels";
import type { BandoActionState } from "@/app/actions/bandos";
import { ContextMenuPortal } from "@/components/ContextMenuPortal";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";

const initialState: BandoActionState = {};

export function ChannelMenu({
  bandoId,
  channelId,
  channelName,
  channelTopic,
  x,
  y,
  onClose,
}: {
  bandoId: string;
  channelId: string;
  channelName: string;
  channelTopic?: string | null;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "rename" | "topic">("menu");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const renameChannelWithId = renameChannel.bind(null, channelId);
  const [renameState, renameAction] = useActionState(
    renameChannelWithId,
    initialState,
  );

  const updateTopicWithId = updateChannelTopic.bind(null, channelId);
  const [topicState, topicAction] = useActionState(
    updateTopicWithId,
    initialState,
  );

  const deleteChannelWithId = deleteChannel.bind(null, bandoId, channelId);

  useEffect(() => {
    if (renameState !== initialState && !renameState.error) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameState]);

  useEffect(() => {
    if (topicState !== initialState && !topicState.error) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicState]);

  return (
    <ContextMenuPortal x={x} y={y} onClose={onClose}>
      {mode === "rename" ? (
        <form action={renameAction} className="flex flex-col gap-2 p-1">
          <input
            type="text"
            name="name"
            required
            minLength={2}
            defaultValue={channelName}
            autoFocus
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          {renameState.error && (
            <p className="text-xs text-danger">{renameState.error}</p>
          )}
          <div className="flex gap-2">
            <SubmitButton
              pendingLabel="Salvando..."
              className="flex-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-95"
            >
              Salvar
            </SubmitButton>
            <button
              type="button"
              onClick={() => setMode("menu")}
              className="flex-1 rounded-full border border-border px-3 py-1.5 text-sm text-muted transition hover:bg-card-2"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : mode === "topic" ? (
        <form action={topicAction} className="flex w-64 flex-col gap-2 p-1">
          <input
            type="text"
            name="topic"
            maxLength={200}
            defaultValue={channelTopic ?? ""}
            autoFocus
            placeholder="Do que se fala nesse canal?"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          {topicState.error && (
            <p className="text-xs text-danger">{topicState.error}</p>
          )}
          <div className="flex gap-2">
            <SubmitButton
              pendingLabel="Salvando..."
              className="flex-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-95"
            >
              Salvar
            </SubmitButton>
            <button
              type="button"
              onClick={() => setMode("menu")}
              className="flex-1 rounded-full border border-border px-3 py-1.5 text-sm text-muted transition hover:bg-card-2"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setMode("rename")}
            className="rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2"
          >
            Editar nome
          </button>
          <button
            type="button"
            onClick={() => setMode("topic")}
            className="rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2"
          >
            Editar tópico
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
          >
            Deletar canal
          </button>
        </div>
      )}

      {confirmingDelete && (
        <Modal onClose={() => setConfirmingDelete(false)}>
          <h3 className="text-lg font-bold text-accent">Deletar canal?</h3>
          <p className="mt-2 text-sm text-muted">
            Tem certeza que quer deletar o canal{" "}
            <span className="font-semibold text-foreground">
              &quot;{channelName}&quot;
            </span>
            ? Essa ação não pode ser desfeita.
          </p>
          <form action={deleteChannelWithId} className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:bg-card-2"
            >
              Cancelar
            </button>
            <SubmitButton
              pendingLabel="Deletando..."
              className="rounded-full bg-danger px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
            >
              Deletar
            </SubmitButton>
          </form>
        </Modal>
      )}
    </ContextMenuPortal>
  );
}
