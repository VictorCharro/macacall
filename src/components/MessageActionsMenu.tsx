"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pin, PinOff, CornerDownRight, Copy } from "lucide-react";
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
  onTogglePin,
  onReply,
  onReact,
}: {
  content: string;
  pinned: boolean;
  canPin: boolean;
  onTogglePin: () => void;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
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
