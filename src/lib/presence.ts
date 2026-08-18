import type { PresenceStatus } from "@/lib/types";

export const STATUS_META: Record<
  PresenceStatus,
  { label: string; dotClass: string; emoji: string; subtitle?: string }
> = {
  online: { label: "Disponível", dotClass: "bg-secondary", emoji: "🟢" },
  idle: { label: "Ausente", dotClass: "bg-primary", emoji: "🌙" },
  dnd: {
    label: "Não perturbe",
    dotClass: "bg-danger",
    emoji: "⛔",
    subtitle: "Você não receberá notificação na área de trabalho",
  },
  invisible: {
    label: "Invisível",
    dotClass: "bg-muted",
    emoji: "⚪",
    subtitle: "Você vai aparecer Off-line",
  },
};
