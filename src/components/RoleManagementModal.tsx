"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  createRole,
  deleteRole,
  reorderRoles,
  updateRole,
} from "@/app/actions/roles";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_LABELS,
  setState,
  stateForKey,
  type PermissionState,
} from "@/lib/permissions";
import type { Role } from "@/lib/types";

const PRESET_COLORS = [
  "#99aab5",
  "#e91e63",
  "#f59e0b",
  "#ffd93d",
  "#22c55e",
  "#059669",
  "#3b82f6",
  "#6366f1",
  "#9b59b6",
  "#ef4444",
];

export function RoleManagementModal({
  bandoId,
  initialRoles,
  onClose,
}: {
  bandoId: string;
  initialRoles: Role[];
  onClose: () => void;
}) {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRoles.find((r) => !r.is_default)?.id ?? initialRoles[0]?.id ?? null,
  );
  const [nameDraft, setNameDraft] = useState("");
  const [nameDraftFor, setNameDraftFor] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  const selected = roles.find((r) => r.id === selectedId) ?? null;
  const assignable = roles.filter((r) => !r.is_default);
  const everyone = roles.find((r) => r.is_default) ?? null;

  if (selected && nameDraftFor !== selected.id) {
    setNameDraftFor(selected.id);
    setNameDraft(selected.name);
  }

  function patchLocal(roleId: string, patch: Partial<Role>) {
    setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, ...patch } : r)));
  }

  async function handleCreate() {
    const form = new FormData();
    form.set("name", "novo cargo");
    form.set("color", "#99aab5");
    const result = await createRole(bandoId, {}, form);
    if (!result.error) {
      // Server action revalidates the page; re-derive the new role isn't
      // returned, so just close-reopen isn't needed — the layout refetch
      // will bring it in. We optimistically bump nothing here to keep this
      // simple and correct.
      location.reload();
    }
  }

  async function handleDelete(roleId: string) {
    if (!confirm("Excluir esse cargo? Isso remove ele de todo mundo que tem.")) return;
    await deleteRole(roleId, bandoId);
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    if (selectedId === roleId) setSelectedId(everyone?.id ?? null);
  }

  function handleDragStart(id: string) {
    dragId.current = id;
  }

  function handleDragOver(overId: string) {
    if (!dragId.current || dragId.current === overId) return;
    setRoles((prev) => {
      const list = [...prev];
      const from = list.findIndex((r) => r.id === dragId.current);
      const to = list.findIndex((r) => r.id === overId);
      if (from === -1 || to === -1) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return list;
    });
  }

  async function handleDrop() {
    dragId.current = null;
    const orderedIds = roles.filter((r) => !r.is_default).map((r) => r.id);
    await reorderRoles(bandoId, orderedIds);
  }

  async function commitName() {
    if (!selected || !nameDraft.trim() || nameDraft === selected.name) return;
    patchLocal(selected.id, { name: nameDraft.trim() });
    await updateRole(selected.id, bandoId, { name: nameDraft.trim() });
  }

  async function setColor(color: string) {
    if (!selected) return;
    patchLocal(selected.id, { color });
    await updateRole(selected.id, bandoId, { color });
  }

  async function toggleHoist() {
    if (!selected) return;
    const hoist = !selected.hoist;
    patchLocal(selected.id, { hoist });
    await updateRole(selected.id, bandoId, { hoist });
  }

  async function cyclePermission(key: (typeof ALL_PERMISSION_KEYS)[number]) {
    if (!selected) return;
    const current = stateForKey(
      selected.permissions_allow,
      selected.permissions_deny,
      key,
    );
    const next: PermissionState =
      current === "inherit" ? "allow" : current === "allow" ? "deny" : "inherit";
    const { allow, deny } = setState(
      BigInt(selected.permissions_allow),
      BigInt(selected.permissions_deny),
      key,
      next,
    );
    patchLocal(selected.id, {
      permissions_allow: allow.toString(),
      permissions_deny: deny.toString(),
    });
    await updateRole(selected.id, bandoId, {
      permissions_allow: allow.toString(),
      permissions_deny: deny.toString(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 animate-overlay-in" onClick={onClose} />
      <div className="relative flex h-[min(80vh,640px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl animate-modal-in">
        <div className="flex w-56 shrink-0 flex-col border-r border-border-soft bg-card-3 p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Cargos — {roles.length}
            </h3>
            <button
              type="button"
              onClick={handleCreate}
              title="Criar cargo"
              aria-label="Criar cargo"
              className="rounded p-1 text-muted transition hover:bg-card-2 hover:text-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <ul className="scroll-hover flex-1 space-y-0.5 overflow-y-auto">
            {assignable.map((role) => (
              <li
                key={role.id}
                draggable
                onDragStart={() => handleDragStart(role.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  handleDragOver(role.id);
                }}
                onDrop={handleDrop}
                onClick={() => setSelectedId(role.id)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                  selectedId === role.id
                    ? "bg-card-2 text-accent"
                    : "text-muted hover:bg-card-2/60 hover:text-foreground"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: role.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{role.name}</span>
              </li>
            ))}
          </ul>

          {everyone && (
            <>
              <div className="my-2 h-px bg-border-soft" />
              <button
                type="button"
                onClick={() => setSelectedId(everyone.id)}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                  selectedId === everyone.id
                    ? "bg-card-2 text-accent"
                    : "text-muted hover:bg-card-2/60 hover:text-foreground"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: everyone.color }}
                  aria-hidden="true"
                />
                @everyone
              </button>
            </>
          )}
        </div>

        <div className="scroll-hover min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-accent">
              {selected?.is_default ? "@everyone" : "Editar cargo"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded p-1 text-muted transition hover:bg-card-2 hover:text-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {selected && (
            <div className="space-y-6">
              {!selected.is_default && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
                    Nome
                  </label>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={commitName}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                  Cor
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={c}
                      className={`h-7 w-7 rounded-full transition ${
                        selected.color === c ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {!selected.is_default && (
                <label className="flex cursor-pointer items-center justify-between rounded-lg bg-card-3 px-3 py-2.5">
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      Exibir separadamente
                    </span>
                    <span className="block text-xs text-muted">
                      Aparece como um grupo próprio na lista de membros.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={selected.hoist}
                    onChange={toggleHoist}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              )}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
                  Permissões
                </label>
                <div className="space-y-1">
                  {ALL_PERMISSION_KEYS.map((key) => {
                    const state = stateForKey(
                      selected.permissions_allow,
                      selected.permissions_deny,
                      key,
                    );
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => cyclePermission(key)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-card-3"
                      >
                        <span>
                          <span className="block text-sm font-medium text-foreground">
                            {PERMISSION_LABELS[key].label}
                          </span>
                          <span className="block text-xs text-muted">
                            {PERMISSION_LABELS[key].description}
                          </span>
                        </span>
                        <PermissionBadge state={state} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {!selected.is_default && (
                <button
                  type="button"
                  onClick={() => handleDelete(selected.id)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir cargo
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissionBadge({ state }: { state: PermissionState }) {
  if (state === "allow") {
    return (
      <span className="shrink-0 rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-bold text-secondary">
        Permitir
      </span>
    );
  }
  if (state === "deny") {
    return (
      <span className="shrink-0 rounded-full bg-danger/15 px-2.5 py-1 text-xs font-bold text-danger">
        Negar
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-card-3 px-2.5 py-1 text-xs font-bold text-muted">
      Neutro
    </span>
  );
}
