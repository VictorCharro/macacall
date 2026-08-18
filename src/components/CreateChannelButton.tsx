"use client";

import { useActionState, useState } from "react";
import { createChannel } from "@/app/actions/channels";
import type { BandoActionState } from "@/app/actions/bandos";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";

const initialState: BandoActionState = {};

export function CreateChannelButton({
  bandoId,
  type,
}: {
  bandoId: string;
  type: "text" | "voice";
}) {
  const [open, setOpen] = useState(false);

  const createChannelWithType = createChannel.bind(null, bandoId, type);
  const [state, formAction] = useActionState(
    createChannelWithType,
    initialState,
  );

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (!state.error) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={type === "text" ? "Criar canal de texto" : "Criar canal de voz"}
        className="rounded p-0.5 text-muted transition hover:text-accent"
      >
        <span className="text-base leading-none">+</span>
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <h3 className="text-lg font-bold text-accent">
            {type === "text" ? "Criar canal de texto" : "Criar canal de voz"}
          </h3>
          <form action={formAction} className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              name="name"
              required
              minLength={2}
              autoFocus
              placeholder={type === "text" ? "novo-canal" : "Nome do canal"}
              className="rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
            {state.error && <p className="text-sm text-danger">{state.error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:bg-card-2"
              >
                Cancelar
              </button>
              <SubmitButton
                pendingLabel="Criando..."
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-95"
              >
                Criar
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
