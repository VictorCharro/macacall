"use client";

import { createBando, joinBandoByCode } from "@/app/actions/bandos";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";

export function CreateOrJoinBandoModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-accent">Criar ou entrar num bando</h3>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border p-4">
        <h4 className="font-semibold text-accent">Criar um bando</h4>
        <form action={createBando} className="flex flex-col gap-3">
          <input
            type="text"
            name="name"
            required
            minLength={2}
            placeholder="Nome do bando"
            className="rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
          />
          <SubmitButton
            pendingLabel="Criando..."
            className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground hover:brightness-95"
          >
            Criar
          </SubmitButton>
        </form>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border p-4">
        <h4 className="font-semibold text-accent">Entrar com código</h4>
        <form action={joinBandoByCode} className="flex flex-col gap-3">
          <input
            type="text"
            name="code"
            required
            minLength={6}
            maxLength={6}
            placeholder="Código de convite"
            className="rounded-lg border border-border bg-background px-3 py-2 uppercase text-foreground outline-none focus:border-primary"
          />
          <SubmitButton
            pendingLabel="Entrando..."
            className="rounded-full bg-secondary px-4 py-2 font-semibold text-secondary-foreground hover:brightness-95"
          >
            Entrar
          </SubmitButton>
        </form>
      </div>
    </Modal>
  );
}
