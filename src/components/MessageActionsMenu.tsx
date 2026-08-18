"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pin, PinOff, CornerDownRight, Copy } from "lucide-react";

export function MessageActionsMenu({
  content,
  pinned,
  canPin,
  onTogglePin,
  onReply,
}: {
  content: string;
  pinned: boolean;
  canPin: boolean;
  onTogglePin: () => void;
  onReply?: () => void;
}) {
  const [open, setOpen] = useState(false);
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
      className={`absolute right-2 -top-3 transition-opacity ${
        open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Mais opções"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card-2 text-muted shadow-sm transition hover:text-accent"
      >
        <MoreHorizontal className="h-4 w-4" />
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
          {onReply && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onReply();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-foreground transition hover:bg-card"
            >
              <CornerDownRight className="h-4 w-4" />
              Responder
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
        </div>
      )}
    </div>
  );
}
