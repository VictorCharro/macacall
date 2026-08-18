"use client";

import { useActionState } from "react";
import { sendFriendRequest } from "@/app/actions/friends";
import type { BandoActionState } from "@/app/actions/bandos";
import { SubmitButton } from "@/components/SubmitButton";

const initialState: BandoActionState = {};

export function AddFriendForm() {
  const [state, formAction] = useActionState(sendFriendRequest, initialState);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-1 font-semibold text-accent">Adicionar amigo</h3>
      <p className="mb-4 text-sm text-muted">
        Você pode adicionar amigos pelo nome de usuário do MacaCall.
      </p>
      <form action={formAction} className="flex gap-2">
        <input
          type="text"
          name="username"
          required
          placeholder="Nome de usuário"
          className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
        />
        <SubmitButton
          pendingLabel="Enviando..."
          className="shrink-0 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-95"
        >
          Enviar pedido
        </SubmitButton>
      </form>
      {state.error && (
        <p className="mt-2 text-sm text-danger">{state.error}</p>
      )}
      {!state.error && state !== initialState && (
        <p className="mt-2 text-sm text-secondary">Pedido enviado! 🍌</p>
      )}
    </div>
  );
}
