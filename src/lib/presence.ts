import type { PresenceStatus } from "@/lib/types";

export const STATUS_META: Record<
  PresenceStatus,
  { label: string; dotClass: string; emoji: string }
> = {
  online: { label: "Disponível", dotClass: "bg-secondary", emoji: "🟢" },
  idle: { label: "Ausente", dotClass: "bg-primary", emoji: "🌙" },
  dnd: { label: "Não perturbe", dotClass: "bg-danger", emoji: "⛔" },
  invisible: { label: "Invisível", dotClass: "bg-muted", emoji: "⚪" },
};
