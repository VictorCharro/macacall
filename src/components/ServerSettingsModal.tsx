"use client";

import { useEffect, useState } from "react";
import { X, UserX, ScrollText } from "lucide-react";
import { listBannedMembers, unbanMember } from "@/app/actions/roles";
import { listAuditLog, type AuditEntry } from "@/app/actions/audit";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/auditLog";
import { avatarUrl } from "@/lib/avatar";

type BannedRow = {
  user_id: string;
  reason: string | null;
  banned_at: string;
  profiles: { username: string; avatar_seed: string; avatar_url: string | null } | null;
};

type Tab = "banned" | "audit";

export function ServerSettingsModal({
  bandoId,
  onClose,
}: {
  bandoId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("banned");
  const [banned, setBanned] = useState<BannedRow[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    if (tab === "banned" && banned === null) {
      listBannedMembers(bandoId).then((rows) => setBanned(rows as unknown as BannedRow[]));
    }
    if (tab === "audit" && audit === null) {
      listAuditLog(bandoId).then(setAudit);
    }
  }, [tab, bandoId, banned, audit]);

  async function handleUnban(userId: string) {
    setBanned((prev) => prev?.filter((b) => b.user_id !== userId) ?? null);
    await unbanMember(bandoId, userId);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-overlay-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[min(80vh,560px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
          <h2 className="text-lg font-black text-accent">Configurações do bando</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-muted transition hover:bg-card-2 hover:text-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border-soft px-3 pt-2">
          <button
            type="button"
            onClick={() => setTab("banned")}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-semibold transition ${
              tab === "banned"
                ? "border-b-2 border-primary text-accent"
                : "text-muted hover:text-accent"
            }`}
          >
            <UserX className="h-4 w-4" />
            Membros banidos
          </button>
          <button
            type="button"
            onClick={() => setTab("audit")}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-semibold transition ${
              tab === "audit"
                ? "border-b-2 border-primary text-accent"
                : "text-muted hover:text-accent"
            }`}
          >
            <ScrollText className="h-4 w-4" />
            Log de auditoria
          </button>
        </div>

        <div className="scroll-hover min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "banned" && (
            <>
              {banned === null && <p className="text-sm text-muted">Carregando...</p>}
              {banned?.length === 0 && (
                <p className="text-sm text-muted">Ninguém banido por aqui.</p>
              )}
              <ul className="flex flex-col gap-1">
                {banned?.map((b) => (
                  <li
                    key={b.user_id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-card-2"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <img
                        src={avatarUrl(b.profiles?.avatar_seed ?? b.user_id, b.profiles?.avatar_url)}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full border border-border bg-card-3 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {b.profiles?.username ?? "Macaco"}
                        </p>
                        {b.reason && (
                          <p className="truncate text-xs text-muted">{b.reason}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnban(b.user_id)}
                      className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-card-3 hover:text-accent"
                    >
                      Desbanir
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === "audit" && (
            <>
              {audit === null && <p className="text-sm text-muted">Carregando...</p>}
              {audit?.length === 0 && (
                <p className="text-sm text-muted">Nenhuma ação registrada ainda.</p>
              )}
              <ul className="flex flex-col gap-2">
                {audit?.map((entry) => (
                  <li key={entry.id} className="text-sm text-foreground">
                    <span className="font-semibold">
                      {entry.profiles?.username ?? "Macaco"}
                    </span>{" "}
                    <span className="text-muted">
                      {AUDIT_ACTION_LABELS[entry.action as AuditAction] ?? entry.action}
                    </span>{" "}
                    {entry.target_label && (
                      <span className="font-semibold">{entry.target_label}</span>
                    )}
                    <span className="ml-2 text-xs text-muted">
                      {new Date(entry.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
