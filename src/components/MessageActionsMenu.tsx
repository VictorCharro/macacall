"use client";

import { useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  Pin,
  PinOff,
  CornerDownRight,
  Copy,
  Pencil,
  Trash2,
  MessageSquarePlus,
} from "lucide-react";
import { QUICK_REACTIONS } from "@/components/MessageReactions";

/**
 * Discord's floating hover bar: quick-react emojis inline, then reply, then
 * everything else behind the "..." menu. Anchored above the message's top-right
 * corner so it overlaps the previous message rather than shifting the row.
 */
export function MessageActionsMenu({
  content,
  pinned,
  canPin,
  canEdit = false,
  canDelete = false,
  onTogglePin,
  onEdit,
  onDelete,
  onReply,
  onReact,
  onStartThread,
}: {
  content: string;
  pinned: boolean;
  canPin: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onTogglePin: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onStartThread?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div
      ref={menuRef}
      className={`absolute -top-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-card-3 p-1 shadow-lg transition-opacity ${
        open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}
    >
      {onReact &&
        QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            title={`Reagir com ${emoji}`}
            aria-label={`Reagir com ${emoji}`}
            className="rounded p-1 text-sm leading-none transition hover:bg-card-2 active:scale-90"
          >
            {emoji}
          </button>
        ))}

      {onReply && (
        <button
          type="button"
          onClick={onReply}
          title="Responder"
          aria-label="Responder"
          className="rounded p-1 text-muted transition hover:bg-card-2 hover:text-accent"
        >
          <CornerDownRight className="h-3.5 w-3.5" />
        </button>
      )}

      {canEdit && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Editar mensagem"
          aria-label="Editar mensagem"
          className="rounded p-1 text-muted transition hover:bg-card-2 hover:text-accent"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Mais opções"
        aria-label="Mais opções"
        className="rounded p-1 text-muted transition hover:bg-card-2 hover:text-accent"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[11rem] animate-modal-in rounded-xl border border-border bg-card-2 p-1.5 shadow-lg">
          {canPin && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onTogglePin();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-foreground transition hover:bg-card"
            >
              {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {pinned ? "Desafixar mensagem" : "Fixar mensagem"}
            </button>
          )}
          {onStartThread && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onStartThread();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-foreground transition hover:bg-card"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Criar thread
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigator.clipboard.writeText(content);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-foreground transition hover:bg-card"
          >
            <Copy className="h-4 w-4" />
            Copiar mensagem
          </button>
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmingDelete(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-danger transition hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" />
              Apagar mensagem
            </button>
          )}
        </div>
      )}

      {confirmingDelete && onDelete && (
        <div
          className="fixed inset-0 z-50 flex animate-overlay-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setConfirmingDelete(false)}
        >
          <div
            className="w-80 animate-modal-in rounded-2xl border border-border bg-card-3 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-accent">Apagar mensagem?</h3>
            <p className="mt-1 text-sm text-muted">
              Essa ação não pode ser desfeita.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-muted transition hover:bg-card-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  onDelete();
                }}
                className="rounded-full bg-danger px-4 py-1.5 text-sm font-semibold text-white transition hover:brightness-90"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
