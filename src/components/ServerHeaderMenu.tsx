"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";

export function ServerHeaderMenu({
  bandoName,
  inviteUrl,
}: {
  bandoName: string;
  inviteUrl: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative border-b border-border">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-bold text-accent transition hover:bg-border/30"
      >
        <span className="truncate">{bandoName}</span>
        <span
          className={`shrink-0 text-xs text-muted transition-transform ${menuOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {menuOpen && (
        <div className="absolute left-2 right-2 top-full z-30 mt-1 animate-modal-in rounded-xl border border-border bg-card p-2 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setInviteOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-border/40"
          >
            <span aria-hidden="true">🐒➕</span>
            Convidar para o bando
          </button>
        </div>
      )}

      {inviteOpen && (
        <Modal onClose={() => setInviteOpen(false)}>
          <h3 className="text-lg font-bold text-accent">
            Convidar para {bandoName}
          </h3>
          <p className="mt-1 text-sm text-muted">
            Manda esse link pra galera entrar no bando 🍌
          </p>
          <div className="mt-4 flex items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.target.select()}
              className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-95"
            >
              {copied ? "Copiado! ✅" : "Copiar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
