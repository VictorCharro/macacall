"use client";

import { AtSign, Users, Megaphone } from "lucide-react";
import type { Mentionable } from "@/lib/mentions";

const ICONS = { user: AtSign, role: Users, everyone: Megaphone } as const;

export function MentionPopup({
  suggestions,
  activeIndex,
  onSelect,
}: {
  suggestions: Mentionable[];
  activeIndex: number;
  onSelect: (m: Mentionable) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-30 mb-1.5 w-64 overflow-hidden rounded-xl border border-border bg-card-2 py-1 shadow-lg">
      {suggestions.map((s, i) => {
        const Icon = ICONS[s.kind];
        return (
          <button
            key={s.key}
            type="button"
            // mousedown (not click) fires before the input blurs, so the
            // selection survives -- a click here would lose focus first and
            // the popup would already be gone by the time it fired.
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(s);
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              i === activeIndex ? "bg-card-3 text-accent" : "text-foreground hover:bg-card-3"
            }`}
          >
            <Icon
              className={`h-3.5 w-3.5 shrink-0 ${s.kind === "user" ? "text-muted" : "text-secondary"}`}
            />
            <span className="truncate">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
