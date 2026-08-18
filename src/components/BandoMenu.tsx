"use client";

import { useEffect, useRef, useState } from "react";
import { renameBando, deleteBando } from "@/app/actions/bandos";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";

export function BandoMenu({
  bandoId,
  bandoName,
}: {
  bandoId: string;
  bandoName: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const renameBandoWithId = renameBando.bind(null, bandoId);
  const deleteBandoWithId = deleteBando.bind(null, bandoId);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-label="Configurações do bando"
        className="rounded-full p-2 text-muted transition hover:bg-border/40 hover:text-accent"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
          {editing ? (
            <form
              action={renameBandoWithId}
              className="flex flex-col gap-2 p-1"
            >
              <input
                type="text"
                name="name"
                required
                minLength={2}
                defaultValue={bandoName}
                autoFocus
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <SubmitButton
                  pendingLabel="Salvando..."
                  className="flex-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-95"
                >
                  Salvar
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-full border border-border px-3 py-1.5 text-sm text-muted transition hover:bg-border/40"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-border/40"
              >
                Editar nome
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmingDelete(true);
                }}
                className="rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
              >
                Deletar bando
              </button>
            </div>
          )}
        </div>
      )}

      {confirmingDelete && (
        <Modal onClose={() => setConfirmingDelete(false)}>
          <h3 className="text-lg font-bold text-accent">Deletar bando?</h3>
          <p className="mt-2 text-sm text-muted">
            Tem certeza que quer deletar o bando{" "}
            <span className="font-semibold text-foreground">
              &quot;{bandoName}&quot;
            </span>
            ? Essa ação não pode ser desfeita.
          </p>
          <form
            action={deleteBandoWithId}
            className="mt-5 flex justify-end gap-2"
          >
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:bg-border/40"
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
    </div>
  );
}
