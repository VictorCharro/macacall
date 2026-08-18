"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  renameBando,
  deleteBando,
  updateBandoPhoto,
  type BandoActionState,
} from "@/app/actions/bandos";
import { Modal } from "@/components/Modal";
import { SubmitButton } from "@/components/SubmitButton";

const initialState: BandoActionState = {};

export function BandoMenu({
  bandoId,
  bandoName,
  onClose,
}: {
  bandoId: string;
  bandoName: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "rename">("menu");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const renameBandoWithId = renameBando.bind(null, bandoId);
  const [renameState, renameAction] = useActionState(
    renameBandoWithId,
    initialState,
  );

  const updateBandoPhotoWithId = updateBandoPhoto.bind(null, bandoId);
  const [photoState, photoAction, photoPending] = useActionState(
    updateBandoPhotoWithId,
    initialState,
  );

  const deleteBandoWithId = deleteBando.bind(null, bandoId);

  useEffect(() => {
    if (renameState !== initialState && !renameState.error) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameState]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute left-full top-0 z-40 min-w-[13rem] animate-modal-in rounded-xl border border-border bg-card p-2 text-left shadow-lg"
    >
      <form action={photoAction} className="hidden">
        <input
          ref={fileInputRef}
          type="file"
          name="photo"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => {
            if (e.target.files?.length) e.target.form?.requestSubmit();
          }}
        />
      </form>

      {mode === "rename" ? (
        <form action={renameAction} className="flex flex-col gap-2 p-1">
          <input
            type="text"
            name="name"
            required
            minLength={2}
            defaultValue={bandoName}
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
            disabled={photoPending}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-card-2 disabled:opacity-60"
          >
            {photoPending ? "Enviando foto..." : "Alterar foto"}
          </button>
          {photoState.error && (
            <p className="px-3 text-xs text-danger">{photoState.error}</p>
          )}
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
          >
            Deletar bando
          </button>
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
    </div>
  );
}
