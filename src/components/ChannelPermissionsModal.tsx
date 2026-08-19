"use client";

import { useEffect, useState } from "react";
import { Hash, RotateCcw } from "lucide-react";
import {
  setChannelOverride,
  removeChannelOverride,
} from "@/app/actions/roles";
import { createClient } from "@/lib/supabase/client";
import {
  CHANNEL_PERMISSION_KEYS,
  PERMISSION_LABELS,
  setState,
  stateForKey,
  type PermissionKey,
  type PermissionState,
} from "@/lib/permissions";
import type { Role } from "@/lib/types";

type Override = {
  id: string;
  role_id: string | null;
  allow: string;
  deny: string;
};

export function ChannelPermissionsModal({
  bandoId,
  channelId,
  channelName,
  roles,
  onClose,
}: {
  bandoId: string;
  channelId: string;
  channelName: string;
  roles: Role[];
  onClose: () => void;
}) {
  // Roles are listed highest-first, but @everyone is the one people tweak most,
  // so it leads — matching how Discord orders the channel permissions list.
  const orderedRoles = [
    ...roles.filter((r) => r.is_default),
    ...roles.filter((r) => !r.is_default),
  ];

  const [overrides, setOverrides] = useState<Override[] | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(
    orderedRoles[0]?.id ?? null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("channel_permission_overrides")
      .select("id, role_id, allow, deny")
      .eq("channel_id", channelId)
      .then(({ data }) => {
        if (!cancelled) setOverrides((data ?? []) as Override[]);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const selectedRole = orderedRoles.find((r) => r.id === selectedRoleId) ?? null;
  const currentOverride =
    overrides?.find((o) => o.role_id === selectedRoleId) ?? null;

  const allowMask = currentOverride?.allow ?? "0";
  const denyMask = currentOverride?.deny ?? "0";

  async function cyclePermission(key: PermissionKey) {
    if (!selectedRole || saving) return;

    const current = stateForKey(allowMask, denyMask, key);
    const next: PermissionState =
      current === "inherit" ? "allow" : current === "allow" ? "deny" : "inherit";

    const { allow, deny } = setState(
      BigInt(allowMask),
      BigInt(denyMask),
      key,
      next,
    );

    setSaving(true);

    // An override with nothing set is just noise — drop the row instead so the
    // channel falls cleanly back to the bando-level permissions.
    if (allow === BigInt(0) && deny === BigInt(0)) {
      if (currentOverride) {
        await removeChannelOverride(currentOverride.id, bandoId);
        setOverrides((prev) =>
          (prev ?? []).filter((o) => o.id !== currentOverride.id),
        );
      }
      setSaving(false);
      return;
    }

    const result = await setChannelOverride(
      channelId,
      bandoId,
      { roleId: selectedRole.id },
      allow.toString(),
      deny.toString(),
    );
    setSaving(false);
    if (result.error) return;

    setOverrides((prev) => {
      const list = prev ?? [];
      const existing = list.find((o) => o.role_id === selectedRole.id);
      if (existing) {
        return list.map((o) =>
          o.id === existing.id
            ? { ...o, allow: allow.toString(), deny: deny.toString() }
            : o,
        );
      }
      return [
        ...list,
        {
          // Placeholder id until the next load; only used as a React key here.
          id: `pending-${selectedRole.id}`,
          role_id: selectedRole.id,
          allow: allow.toString(),
          deny: deny.toString(),
        },
      ];
    });
  }

  async function resetRole() {
    if (!currentOverride || saving) return;
    setSaving(true);
    await removeChannelOverride(currentOverride.id, bandoId);
    setOverrides((prev) => (prev ?? []).filter((o) => o.id !== currentOverride.id));
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-overlay-in bg-black/50" onClick={onClose} />
      <div className="relative flex h-[min(80vh,560px)] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl animate-modal-in">
        <div className="flex w-52 shrink-0 flex-col border-r border-border-soft bg-card-3 p-3">
          <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted">
            Cargos
          </h3>
          <ul className="scroll-hover flex-1 space-y-0.5 overflow-y-auto">
            {orderedRoles.map((role) => {
              const hasOverride = overrides?.some((o) => o.role_id === role.id);
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                      selectedRoleId === role.id
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
                    {hasOverride && (
                      <span
                        className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        title="Tem permissões personalizadas nesse canal"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="scroll-hover min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-1 flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted" />
            <h2 className="truncate text-lg font-black text-accent">
              {channelName}
            </h2>
          </div>
          <p className="mb-4 text-xs text-muted">
            Permissões aqui valem só nesse canal e sobrescrevem as do cargo.
            &quot;Neutro&quot; herda o que o cargo já tem.
          </p>

          {overrides === null ? (
            <p className="text-sm text-muted">carregando...</p>
          ) : (
            <>
              <div className="space-y-1">
                {CHANNEL_PERMISSION_KEYS.map((key) => {
                  const state = stateForKey(allowMask, denyMask, key);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={saving}
                      onClick={() => cyclePermission(key)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-card-3 disabled:opacity-60"
                    >
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          {PERMISSION_LABELS[key].label}
                        </span>
                        <span className="block text-xs text-muted">
                          {PERMISSION_LABELS[key].description}
                        </span>
                      </span>
                      <StateBadge state={state} />
                    </button>
                  );
                })}
              </div>

              {currentOverride && (
                <button
                  type="button"
                  onClick={resetRole}
                  disabled={saving}
                  className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-card-3 hover:text-accent disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" />
                  Voltar ao padrão do cargo
                </button>
              )}
            </>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-95"
            >
              Concluído
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: PermissionState }) {
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
